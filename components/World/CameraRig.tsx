'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';

import {
  createFlightView,
  flightPosition,
  flightRotation,
  lookRotation,
  planFlight,
  smootherstep,
} from './flight';
import { isBooted } from './boot';
import { applyShake } from './shake';
import { baseFov, stationCamera, stationKeys, stationPositions } from './stations';
import { worldMode } from './worldMode';
import { emitFlight, worldStore } from './worldStore';

import type { Flight, FlightView } from './flight';
import type { StationKey } from './stations';
import type { WorldMode } from './worldMode';

const target = new Vector3();
const look = new Vector3();
const origin = new Vector3();
const lookCurrent = new Vector3();
const previous = new Vector3();
const correction = new Vector3();
const forward = new Vector3();
const toPoint = new Vector3();
const rotationTo = new Quaternion();
const bank = new Quaternion();
const lockOn = new Vector3();
const previewEye = new Vector3();
const previewLook = new Vector3();
const yAxis = new Vector3(0, 1, 0);
const zAxis = new Vector3(0, 0, 1);
const introOffset = new Vector3(-14, 10, 58);

/** Shortest signed angle from `a` to `b` */
const wrap = (angle: number) => MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;

interface RigState {
  progress: number;
  screens: number;
  started: boolean;
  station: StationKey | null;
  mode: WorldMode;
  flight: Flight | null;
  approached: boolean;
  view: FlightView;
  /** Heading on the previous frame (radians), for banking into turns */
  heading: number | null;
  roll: number;
  velocity: Vector3;
  arrivedAt: number;
  /** The station the route preview was last planned to ('' for none) */
  preview: string;
}

/**
 * Flies the camera to the active station along a planned path, then follows
 * page scroll inside it. Camera speed feeds worldStore.velocity, which the
 * starfield, FOV and chromatic aberration use for the warp effect. In explore
 * mode the visitor's controls own the camera; leaving it flies back here.
 */
export function CameraRig({
  station,
  reducedMotion,
}: {
  station: StationKey;
  reducedMotion: boolean;
}) {
  const state = useRef<RigState>({
    progress: 0,
    screens: 0,
    started: false,
    station: null,
    mode: 'page',
    flight: null,
    approached: false,
    view: createFlightView(),
    heading: null,
    roll: 0,
    velocity: new Vector3(),
    arrivedAt: 0,
    preview: '',
  });

  useFrame(({ camera, clock, size }, delta) => {
    const cam = camera as PerspectiveCamera;
    const dt = Math.min(delta, 1 / 20);
    const rig = state.current;
    const { mode } = worldMode.get();
    const t = clock.elapsedTime;

    if (worldStore.launchRequested) {
      worldStore.launchRequested = false;
      worldStore.launchAt = t;
    }

    if (mode === 'explore') {
      // ExploreControls flies the camera; resume from wherever it leaves off
      if (rig.flight) endFlight(rig, station, false);
      rig.mode = mode;
      record(cam);
      return;
    }

    // Tours ignore the page's scroll: each stop is framed from the top
    const scrollTarget = mode === 'page' ? worldStore.scroll : 0;
    const screensTarget = mode === 'page' ? worldStore.screens : 0;
    const retarget = rig.station !== station || rig.mode !== mode;
    // A new page opens at its top: fly there, not to the scroll still easing
    // out from the last page (or that page's scroll, which the store can hold
    // for a frame). Leaving the bottom of a long page, that aimed the flight
    // far below the station until it corrected at the end. Switching between
    // the page, the tour and free roam picks the page up where it is scrolled
    const newPage = retarget && rig.station !== null && mode === 'page' && rig.mode === 'page';
    if (newPage) {
      rig.progress = 0;
      rig.screens = 0;
    } else if (reducedMotion || retarget) {
      rig.progress = scrollTarget;
      rig.screens = screensTarget;
    } else {
      easing.damp(rig, 'progress', scrollTarget, 0.14, dt);
      easing.damp(rig, 'screens', screensTarget, 0.14, dt);
    }

    stationCamera(station, rig.progress, rig.screens, size.width, size.height, target, look);
    origin.fromArray(stationPositions[station]);
    target.add(origin);
    look.add(origin);

    // A slow orbit while the tour lingers at a stop
    if (mode === 'tour' && !rig.flight) {
      const angle = Math.sin((t - rig.arrivedAt) * 0.22) * 0.32;
      target.sub(look).applyAxisAngle(yAxis, angle).add(look);
    }

    if (!reducedMotion && mode === 'page') {
      target.x += worldStore.pointerX * 0.45;
      target.y += worldStore.pointerY * 0.28;
    }

    // Out in deep space until the loading screen lifts, then warp in
    if (!rig.started && !reducedMotion && !isBooted()) {
      cam.position.copy(target).add(introOffset);
      cam.lookAt(look);
      record(cam);
      return;
    }
    if (!rig.started) {
      // First frame: start out in deep space and warp in
      rig.started = true;
      lookCurrent.copy(look);
      if (reducedMotion) cam.position.copy(target);
      else {
        cam.position.copy(target).add(introOffset);
        cam.lookAt(look);
        startFlight(rig, cam, station);
      }
    } else if (retarget && !reducedMotion) {
      startFlight(rig, cam, station);
    }
    rig.station = station;
    rig.mode = mode;

    previous.copy(cam.position);
    if (reducedMotion) {
      cam.position.copy(target);
      lookCurrent.copy(look);
      cam.lookAt(lookCurrent);
    } else if (rig.flight) {
      fly(rig, cam, station, dt, t);
    } else {
      easing.damp3(cam.position, target, 0.2, dt);
      easing.damp3(lookCurrent, look, 0.16, dt);
      cam.lookAt(lookCurrent);
    }

    // Snapped (reduced-motion) cameras jump between poses; that is not flight
    const speed = reducedMotion ? 0 : cam.position.distanceTo(previous) / Math.max(dt, 1e-4);
    rig.velocity.subVectors(cam.position, previous).divideScalar(Math.max(dt, 1e-4));
    worldStore.velocity = speed;

    const fov = baseFov + (reducedMotion ? 0 : Math.min(speed * 0.3, 24));
    easing.damp(cam, 'fov', fov, 0.3, dt);
    cam.updateProjectionMatrix();
    applyShake(cam, t, dt, reducedMotion);
    record(cam);
    if (mode === 'page') planPreview(rig, cam, size.width, size.height);
  });

  return null;
}

function startFlight(rig: RigState, cam: PerspectiveCamera, station: StationKey) {
  // Plan from wherever the camera is and however it is turned: mid-flight,
  // banked, or wherever the visitor left it in explore mode. Ahead, it
  // locks onto the station itself on the way
  lockOn.fromArray(stationPositions[station]);
  const flight = planFlight(cam.position, cam.quaternion, target, look, rig.velocity, lockOn);
  rig.flight = flight;
  rig.approached = false;
  if (!flight) return;
  rig.view.started = false;
  rig.heading = null;
  // Any bank the camera carried is in its starting rotation, which blends out
  rig.roll = 0;

  const path = new Float32Array(26 * 3);
  for (let i = 0; i <= 25; i++) toPoint.copy(flight.curve.getPointAt(i / 25)).toArray(path, i * 3);
  worldStore.flight.active = true;
  worldStore.flight.to = station;
  worldStore.flight.progress = 0;
  worldStore.flight.path = path;
  worldStore.flight.turn = flight.about ? flight.departTurn : 0;
  worldStore.flight.approached = false;
  emitFlight('start', station);
}

function endFlight(rig: RigState, station: StationKey, arrived: boolean) {
  rig.flight = null;
  worldStore.flight.active = false;
  worldStore.flight.progress = arrived ? 1 : worldStore.flight.progress;
  if (arrived) emitFlight('end', station);
}

function fly(rig: RigState, cam: PerspectiveCamera, station: StationKey, dt: number, t: number) {
  const flight = rig.flight!;
  flight.elapsed += dt;
  const s = Math.min(flight.elapsed / flight.duration, 1);

  // Position on the path, drifting onto the live target (scroll, pointer and
  // resizes keep moving it) over the second half
  flightPosition(flight, s, cam.position);
  correction.subVectors(target, flight.end).multiplyScalar(smootherstep((s - 0.5) / 0.5));
  cam.position.add(correction);

  // Planned rotation into the live destination view (see flightRotation)
  lookRotation(target, look, rotationTo);
  flightRotation(flight, rig.view, s, cam.position, rotationTo, dt, cam.quaternion);

  // Bank into heading changes, levelling out for the arrival
  forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
  const heading = Math.atan2(forward.x, -forward.z);
  const rate = rig.heading === null ? 0 : wrap(heading - rig.heading) / Math.max(dt, 1e-4);
  rig.heading = heading;
  const level = 1 - smootherstep((s - 0.65) / 0.3);
  rig.roll = MathUtils.damp(rig.roll, MathUtils.clamp(-rate * 0.15, -0.25, 0.25), 5, dt);
  cam.quaternion.multiply(bank.setFromAxisAngle(zAxis, rig.roll * level));

  worldStore.flight.progress = s;
  // About-turns are on their final approach once the arc starts rounding the station
  const approach = flight.about ? flight.roundFrom : 0.6;
  if (!rig.approached && s >= approach) {
    rig.approached = true;
    worldStore.flight.approached = true;
    emitFlight('approach', station);
  }
  if (s >= 1) {
    lookCurrent.copy(look);
    rig.arrivedAt = t;
    endFlight(rig, station, true);
  }
}

/**
 * Plots the route to the station a hovered or focused link leads to, for
 * the radar's preview: planned the way the flight would be, from where the
 * camera is to the top of that page. Re-planned only when the link changes
 */
function planPreview(rig: RigState, cam: PerspectiveCamera, width: number, height: number) {
  const key = worldStore.preview as StationKey;
  if (key === rig.preview) return;
  rig.preview = key;
  worldStore.previewPath = new Float32Array(0);
  if (!key || !stationKeys.includes(key) || rig.flight) return;
  stationCamera(key, 0, 0, width, height, previewEye, previewLook);
  origin.fromArray(stationPositions[key]);
  previewEye.add(origin);
  previewLook.add(origin);
  const plan = planFlight(
    cam.position,
    cam.quaternion,
    previewEye,
    previewLook,
    rig.velocity,
    origin
  );
  if (!plan) return;
  const path = new Float32Array(26 * 3);
  for (let i = 0; i <= 25; i++) toPoint.copy(plan.curve.getPointAt(i / 25)).toArray(path, i * 3);
  worldStore.previewPath = path;
}

/** Publishes the camera's position and heading for the radar */
function record(cam: PerspectiveCamera) {
  forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
  worldStore.camera.x = cam.position.x;
  worldStore.camera.y = cam.position.y;
  worldStore.camera.z = cam.position.z;
  worldStore.camera.heading = Math.atan2(forward.x, -forward.z);
  worldStore.camera.fx = forward.x;
  worldStore.camera.fy = forward.y;
  worldStore.camera.fz = forward.z;
}
