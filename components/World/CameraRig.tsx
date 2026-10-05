'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';

import { bezier, parameterAt, planFlight, smootherstep } from './flight';
import { baseFov, stationCamera, stationPositions } from './stations';
import { worldMode } from './worldMode';
import { emitFlight, worldStore } from './worldStore';

import type { Flight } from './flight';
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
const euler = new Euler(0, 0, 0, 'YXZ');
const bank = new Quaternion();
const yAxis = new Vector3(0, 1, 0);
const zAxis = new Vector3(0, 0, 1);
const introOffset = new Vector3(-14, 10, 58);

/** Camera yaw (camera convention: 0 looks down -Z) and pitch towards a point */
function aim(from: Vector3, to: Vector3) {
  toPoint.subVectors(to, from);
  const yaw = Math.atan2(-toPoint.x, -toPoint.z);
  const pitch = Math.atan2(toPoint.y, Math.hypot(toPoint.x, toPoint.z));
  return { yaw, pitch: MathUtils.clamp(pitch, -1.35, 1.35) };
}

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
  /** Which way the camera turns during the current flight (fixed so it never flips) */
  turn: number;
  yaw: number;
  roll: number;
  velocity: Vector3;
  arrivedAt: number;
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
    turn: 0,
    yaw: 0,
    roll: 0,
    velocity: new Vector3(),
    arrivedAt: 0,
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
    if (reducedMotion) {
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

    const retarget = rig.station !== station || rig.mode !== mode;
    if (!rig.started) {
      // First frame: start out in deep space and warp in
      rig.started = true;
      lookCurrent.copy(look);
      if (reducedMotion) cam.position.copy(target);
      else {
        cam.position.copy(target).add(introOffset);
        startFlight(rig, cam, station);
      }
    } else if (retarget && !reducedMotion) {
      if (rig.mode === 'explore') {
        // Pick up from where the visitor was looking
        forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
        lookCurrent.copy(cam.position).addScaledVector(forward, 20);
      }
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
    record(cam);
  });

  return null;
}

function startFlight(rig: RigState, cam: PerspectiveCamera, station: StationKey) {
  const flight = planFlight(cam.position, lookCurrent, target, look, rig.velocity);
  rig.flight = flight;
  rig.approached = false;
  if (!flight) return;
  // Choose the turning direction once, so the camera never swaps sides mid-turn
  const from = aim(cam.position, lookCurrent);
  const to = aim(target, look);
  rig.turn = wrap(to.yaw - from.yaw);
  rig.yaw = from.yaw;
  rig.roll = 0;

  const path = new Float32Array(26 * 2);
  for (let i = 0; i <= 25; i++) {
    bezier(flight, i / 25, toPoint);
    path[i * 2] = toPoint.x;
    path[i * 2 + 1] = toPoint.z;
  }
  worldStore.flight.active = true;
  worldStore.flight.to = station;
  worldStore.flight.progress = 0;
  worldStore.flight.path = path;
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
  const eased = smootherstep(s);

  // Position on the curve, drifting onto the live target (scroll, pointer and
  // resizes keep moving it) over the second half
  bezier(flight, parameterAt(flight, eased), cam.position);
  correction.subVectors(target, flight.p3).multiplyScalar(smootherstep((s - 0.5) / 0.5));
  cam.position.add(correction);

  // Turn from the old focus to the new one over the first 70% of the flight,
  // always the same way round; pitch follows whichever point dominates
  const from = aim(cam.position, flight.lookFrom);
  const to = aim(cam.position, look);
  const w = smootherstep((s - 0.06) / 0.64);
  let span = wrap(to.yaw - from.yaw);
  if (Math.sign(span) !== Math.sign(rig.turn) && Math.abs(span) > Math.PI / 2) {
    span += Math.sign(rig.turn) * Math.PI * 2;
  }
  const yaw = from.yaw + span * w;
  const pitch = MathUtils.lerp(from.pitch, to.pitch, w);

  // Bank into the turn, levelling out as it ends
  const yawRate = wrap(yaw - rig.yaw) / Math.max(dt, 1e-4);
  rig.yaw = yaw;
  const roll = MathUtils.clamp(yawRate * 0.18, -0.32, 0.32) * (1 - smootherstep((s - 0.6) / 0.3));
  rig.roll = MathUtils.damp(rig.roll, roll, 6, dt);

  euler.set(pitch, yaw, 0, 'YXZ');
  cam.quaternion.setFromEuler(euler);
  bank.setFromAxisAngle(zAxis, rig.roll);
  cam.quaternion.multiply(bank);

  worldStore.flight.progress = s;
  if (!rig.approached && s >= 0.6) {
    rig.approached = true;
    emitFlight('approach', station);
  }
  if (s >= 1) {
    lookCurrent.copy(look);
    rig.arrivedAt = t;
    endFlight(rig, station, true);
  }
}

/** Publishes the camera's position and heading for the radar */
function record(cam: PerspectiveCamera) {
  forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
  worldStore.camera.x = cam.position.x;
  worldStore.camera.y = cam.position.y;
  worldStore.camera.z = cam.position.z;
  worldStore.camera.heading = Math.atan2(forward.x, -forward.z);
}
