'use client';

import { useEffect, useRef } from 'react';
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
import {
  baseFov,
  pageProjectFocus,
  rideProjectFocus,
  stationCamera,
  stationKeys,
  stationPositions,
} from './stations';
import { worldMode } from './worldMode';
import { emitCue, emitFlight, worldStore } from './worldStore';

import type { MotionLevel } from '@/utils/motion';
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
const parallaxForward = new Vector3();
const parallaxSide = new Vector3();
const parallaxUp = new Vector3();
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
  ride: Ride;
  /** The camera cut (motion held back) to a new pose it should announce as an arrival */
  arriving: boolean;
  /** A dipped cut (D10): until when (performance.now(), ms) the camera holds before it cuts, 0 for none */
  cutAt: number;
  cutTimers: number[];
  /** Where the settled camera is heading and looking, never faster than `followSpeed` */
  follow: Vector3;
  followLook: Vector3;
}

/**
 * The projects focus the camera rides (stations.ts reads it): it passes
 * the page's straight through while that moves a little at a time (the
 * scroll runway), and hops along the helix when it jumps (prev / next on a
 * project page, a modal opening another project, End on the runway)
 */
interface Ride {
  /** -1 when there is nothing to ride (off the projects pages) */
  value: number;
  hopping: boolean;
  from: number;
  to: number;
  start: number;
  duration: number;
  /** The hop crosses a screen or more: it sounded on the way and locks on arrival */
  long: boolean;
}

/**
 * A cut below full motion (D10): the canvas fades out (html[data-world-cut]
 * = 'out', World.scss), the view holds for `cutHold` ms while it does, then
 * cuts and fades back in ('in', cleared after `cutIn` ms). Drawn on demand
 * at `still`, so frames are asked for when the hold ends and once it is in
 */
const cutHold = 160;
const cutIn = 300;

function beginCut(rig: RigState, invalidate: () => void) {
  rig.cutTimers.forEach((timer) => window.clearTimeout(timer));
  rig.cutAt = performance.now() + cutHold;
  document.documentElement.dataset.worldCut = 'out';
  rig.cutTimers = [
    window.setTimeout(invalidate, cutHold + 10),
    window.setTimeout(invalidate, cutHold + cutIn + 20),
  ];
}

function endCut(rig: RigState) {
  rig.cutAt = 0;
  const root = document.documentElement;
  root.dataset.worldCut = 'in';
  rig.cutTimers.push(
    window.setTimeout(() => {
      if (root.dataset.worldCut === 'in') delete root.dataset.worldCut;
    }, cutIn)
  );
}

/**
 * Fastest the camera follows the page (units per second): a jump in scroll
 * (End, Home, a long page's companion poses) glides the camera there rather
 * than throwing it at lightspeed, which the streaks and FOV kick read from
 * its speed. Flights aren't held to it
 */
const followSpeed = 35;

/** Moves `point` towards `goal` by at most `step` */
function approach(point: Vector3, goal: Vector3, step: number) {
  const distance = point.distanceTo(goal);
  if (distance <= step) point.copy(goal);
  else point.lerp(goal, step / distance);
}

/** Jumps smaller than this pass straight through, so the runway is as responsive as ever */
const rideJump = 0.5;

/**
 * Flies the camera to the active station along a planned path, then follows
 * page scroll inside it. Camera speed feeds worldStore.velocity, which the
 * starfield, FOV and chromatic aberration use for the warp effect. In explore
 * mode the visitor's controls own the camera; leaving it flies back here.
 */
export function CameraRig({ station, motion }: { station: StationKey; motion: MotionLevel }) {
  // Below full motion (calm and still) the camera cuts to each pose instead of
  // flying or easing there: no flights, warp in, parallax, tour orbit or shake
  const snap = motion !== 'full';
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
    ride: { value: -1, hopping: false, from: 0, to: 0, start: 0, duration: 0, long: false },
    arriving: false,
    cutAt: 0,
    cutTimers: [],
    follow: new Vector3(),
    followLook: new Vector3(),
  });

  // A cut under way when the world goes (switched off, a remount) leaves nothing behind
  useEffect(() => {
    const rig = state.current;
    return () => {
      rig.cutTimers.forEach((timer) => window.clearTimeout(timer));
      delete document.documentElement.dataset.worldCut;
    };
  }, []);

  useFrame(({ camera, clock, size, frameloop, invalidate }, delta) => {
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
    } else if (snap || retarget) {
      rig.progress = scrollTarget;
      rig.screens = screensTarget;
    } else {
      easing.damp(rig, 'progress', scrollTarget, 0.14, dt);
      easing.damp(rig, 'screens', screensTarget, 0.14, dt);
    }

    // The projects ride: off it, nothing to ride
    const ridingTo = worldStore.projectFocus < 0 ? -1 : pageProjectFocus();
    rideProjectFocus(stepRide(rig.ride, ridingTo, t, snap));
    stationCamera(station, rig.progress, rig.screens, size.width, size.height, target, look);
    origin.fromArray(stationPositions[station]);
    target.add(origin);
    look.add(origin);

    // A slow orbit while the tour lingers at a stop (none when the camera
    // cuts: it would turn the view continuously, or jump on each repaint)
    if (mode === 'tour' && !rig.flight && !snap) {
      const angle = Math.sin((t - rig.arrivedAt) * 0.22) * 0.32;
      target.sub(look).applyAxisAngle(yAxis, angle).add(look);
    }

    // Pointer parallax, along the pose's own sideways and up axes: in world
    // x and y it pushed the camera towards or away from whatever it faced
    // side on (the projects ride's screens face every way round the helix)
    if (!snap && mode === 'page') {
      parallaxForward.subVectors(look, target).normalize();
      parallaxSide.crossVectors(parallaxForward, yAxis).normalize();
      parallaxUp.crossVectors(parallaxSide, parallaxForward);
      target
        .addScaledVector(parallaxSide, worldStore.pointerX * 0.45)
        .addScaledVector(parallaxUp, worldStore.pointerY * 0.28);
    }

    // Out in deep space until the loading screen lifts, then warp in
    if (!rig.started && !snap && !isBooted()) {
      cam.position.copy(target).add(introOffset);
      cam.lookAt(look);
      record(cam);
      return;
    }
    // Motion held back mid-flight (or mid warp in): the camera cuts, and the
    // flight it was on arrives at its station (still rig.station here)
    if (snap && rig.flight) cutFlight(rig, rig.station ?? station, t);
    if (!rig.started) {
      // First frame: start out in deep space and warp in
      rig.started = true;
      lookCurrent.copy(look);
      if (snap) cam.position.copy(target);
      else {
        cam.position.copy(target).add(introOffset);
        cam.lookAt(look);
        startFlight(rig, cam, station);
      }
    } else if (retarget && !snap) {
      startFlight(rig, cam, station);
    } else if (retarget) {
      // Motion held back: the camera cuts where it would fly, and arrives
      // the way a flight does once it has (no 'start': nothing powers down).
      // A new station dips the canvas out first, and back in after the cut
      rig.arriving = true;
      if (rig.station !== station) beginCut(rig, invalidate);
    }
    rig.station = station;
    rig.mode = mode;

    previous.copy(cam.position);
    if (rig.cutAt && (!snap || performance.now() >= rig.cutAt)) endCut(rig);
    if (snap && rig.cutAt) {
      // Dipped out: hold the old view until the canvas has faded
    } else if (snap) {
      const moved =
        previous.distanceToSquared(target) > 1e-6 || lookCurrent.distanceToSquared(look) > 1e-6;
      cam.position.copy(target);
      lookCurrent.copy(look);
      cam.lookAt(lookCurrent);
      // Drawn on demand (still), a frame asked for by a scroll can run before
      // the page has measured where it is read (pageInputs measures in its
      // own animation frame), and nothing would ask for the next: the pose
      // stayed a measure behind (a whole jump behind after End or Home).
      // While it still moves, ask for one more frame
      if (moved && frameloop === 'demand') invalidate();
      if (rig.arriving) {
        rig.arriving = false;
        rig.arrivedAt = t;
        emitFlight('end', station);
      }
    } else if (rig.flight) {
      fly(rig, cam, station, dt, t);
    } else {
      approach(rig.follow, target, followSpeed * dt);
      approach(rig.followLook, look, followSpeed * dt);
      easing.damp3(cam.position, rig.follow, 0.2, dt);
      easing.damp3(lookCurrent, rig.followLook, 0.16, dt);
      cam.lookAt(lookCurrent);
    }
    // Cut or flown there, the camera is where the page has it
    if (snap || rig.flight) {
      rig.follow.copy(target);
      rig.followLook.copy(look);
    }

    // Snapped cameras (motion held back) jump between poses; that is not flight
    const speed = snap ? 0 : cam.position.distanceTo(previous) / Math.max(dt, 1e-4);
    rig.velocity.subVectors(cam.position, previous).divideScalar(Math.max(dt, 1e-4));
    worldStore.velocity = speed;

    const fov = baseFov + (snap ? 0 : Math.min(speed * 0.3, 24));
    easing.damp(cam, 'fov', fov, 0.3, dt);
    cam.updateProjectionMatrix();
    applyShake(cam, t, dt, snap);
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
  worldStore.flight.duration = flight.duration;
  emitFlight('start', station);
}

function endFlight(rig: RigState, station: StationKey, arrived: boolean) {
  rig.flight = null;
  worldStore.flight.active = false;
  worldStore.flight.progress = arrived ? 1 : worldStore.flight.progress;
  if (arrived) emitFlight('end', station);
  worldStore.flight.duration = 0;
}

/**
 * Ends a flight the camera cut short (the motion level dropped below full
 * on the way) the way a flight ends: on approach (the station powers back
 * on, the page's copy is let through) and then arrived, so nothing is left
 * waiting on it, and a return to full motion doesn't resume a stale path
 */
function cutFlight(rig: RigState, station: StationKey, t: number) {
  if (!rig.approached) {
    rig.approached = true;
    worldStore.flight.approached = true;
    emitFlight('approach', station);
  }
  rig.arrivedAt = t;
  endFlight(rig, station, true);
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

/**
 * Moves the ridden projects focus towards `goal` (-1 off the projects
 * pages): straight through while it moves less than `rideJump` at a time,
 * else a hop along the helix, smootherstep over 0.8 to 2.2s depending on
 * its length. Hops over a screen or more sound as they set off ('select')
 * and as they lock on ('hud-lock'). Cuts at reduced motion
 */
function stepRide(ride: Ride, goal: number, t: number, snap: boolean) {
  if (snap || goal < 0 || ride.value < 0) {
    ride.value = goal;
    ride.hopping = false;
    return ride.value;
  }
  if (ride.hopping && Math.abs(goal - ride.to) >= rideJump) {
    // Jumped again mid-hop: a fresh hop from where it has got to
    ride.hopping = false;
  }
  if (!ride.hopping) {
    if (Math.abs(goal - ride.value) < rideJump) {
      ride.value = goal;
      return ride.value;
    }
    const span = Math.abs(goal - ride.value);
    ride.hopping = true;
    ride.from = ride.value;
    ride.start = t;
    ride.duration = MathUtils.clamp(0.8 + 0.12 * span, 0.8, 2.2);
    ride.long = span >= 1;
    if (ride.long) emitCue('select');
  }
  // A goal that drifts a little while hopping (the runway still settling) is followed
  ride.to = goal;
  const s = (t - ride.start) / ride.duration;
  if (s >= 1) {
    ride.value = ride.to;
    ride.hopping = false;
    if (ride.long) emitCue('hud-lock');
    return ride.value;
  }
  ride.value = MathUtils.lerp(ride.from, ride.to, smootherstep(s));
  return ride.value;
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
