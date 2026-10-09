'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Euler, Fog, MathUtils, PerspectiveCamera, Vector3 } from 'three';

import { motionLevel } from '@/utils/motion';

import { canLockPointer, lockPointer } from './pointerLock';
import { navigableStations, stationForPath } from './routes';
import { applyShake } from './shake';
import { setViewRange, useLite } from './stationHooks';
import { baseFov, beaconHeight, stationPositions } from './stations';
import { worldMode } from './worldMode';
import {
  emitCue,
  exploreInput,
  setAutopilot,
  setDock,
  setDocking,
  worldBumpEvent,
  worldStore,
} from './worldStore';

import type { Scene } from 'three';
import type { StationKey } from './routes';

/* ------------------------------------------------------------------
   Free flight. While the world is in explore mode the visitor flies the
   camera: keys or the on-screen pad to move, and the mouse steers. The
   pointer is locked, so the cursor stays in the middle of the screen and
   every movement turns the view at once, like a flight sim (Esc frees
   the mouse for the HUD; a click takes it back). Where the pointer can't
   be locked, the further the mouse rests from the centre the faster the
   view turns that way. Touch gets twin thumbsticks instead (ExploreHud):
   one flies, the other turns the view the way it is held.

   Finding your way: the fog draws back so distant stations stay in
   sight, the HUD marks every station (edge arrows for those off screen),
   and the number keys (or a click on a marker) set the autopilot, which
   turns, flies and brakes to park in front of that station. Flying close
   to a station offers to dock, which opens its page (the camera rig then
   flies the last stretch in). Hulls push you back out rather than
   letting you clip inside them.
   ------------------------------------------------------------------ */

const keys = new Map<string, keyof typeof exploreInput>([
  ['KeyW', 'forward'],
  ['ArrowUp', 'forward'],
  ['KeyS', 'forward'],
  ['ArrowDown', 'forward'],
  ['KeyA', 'strafe'],
  ['KeyD', 'strafe'],
  ['ArrowLeft', 'turn'],
  ['ArrowRight', 'turn'],
  ['Space', 'lift'],
  ['KeyC', 'lift'],
]);
const negative = new Set(['KeyS', 'ArrowDown', 'KeyA', 'ArrowLeft', 'KeyC']);
/** Digit keys set course: 0 is Home, as on the beacons and the HUD */
const digit = /^(?:Digit|Numpad)(\d)$/;

const euler = new Euler(0, 0, 0, 'YXZ');
const forward = new Vector3();
const right = new Vector3();
const up = new Vector3(0, 1, 0);
const velocity = new Vector3();
const wish = new Vector3();
const station = new Vector3();
const goal = new Vector3();
const aim = new Vector3();
const point = new Vector3();
const view = new Vector3();
const centre = new Vector3(0, 0, -110);

const dockRange = 18;
/** Pointer locked: radians of turn per pixel the mouse moves */
const lookSpeed = 0.0021;
/** Free pointer: dead zone at the centre, and the fastest turn at the screen edge (rad/s) */
const deadZone = 0.05;
const maxYawRate = 3;
const maxPitchRate = 2;
/** Free pointer: radians of turn per pixel the mouse moves, so a flick turns the view at once */
const nudge = 0.0016;
/** Touch look stick: dead zone, and the fastest turn with it held right over (rad/s) */
const stickDeadZone = 0.12;
const stickYawRate = 1.9;
const stickPitchRate = 1.2;
const hullRadius = 5.5;
/** Fastest a bump into a hull can be met without a jolt (units per second) */
const gentle = 3;
/** Steepest bank into a turn (radians), and how much each radian a second of turning banks */
const maxBank = 0.3;
const bankPerRate = 0.13;
const worldRadius = 520;
/** Fog in free roam: pushed out this far so the whole line of stations stays in sight */
const exploreFog = { near: 70, far: 460, liteFar: 300 };
/** Autopilot: parks this far in front of the station's face (pages frame it from +Z) */
const approach = new Vector3(0, 1.5, 16);
/** Autopilot: coming from behind a station it rounds its side, this far out, rather than through it */
const rounding = 22;
/** Autopilot: top speed, braking (units/s²) and turn rate cap (rad/s) */
const autoSpeed = 58;
const autoBrake = 16;
const autoTurn = 1.7;
/** Mouse travel (px, locked) that takes the controls back from the autopilot */
const takeOver = 80;

/** Shortest signed angle from `a` to `b` */
const wrap = (angle: number) => MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;

/** 0 inside the dead zone, rising to ±1 at the edge of the screen */
function steering(offset: number) {
  const amount = MathUtils.clamp((Math.abs(offset) - deadZone) / (1 - deadZone), 0, 1);
  return Math.sign(offset) * amount * (0.6 + 0.4 * amount);
}

/** 0 inside the dead zone, rising to ±1 held right over; squared, so small pushes aim finely */
function stickTurn(offset: number) {
  const amount = MathUtils.clamp((Math.abs(offset) - stickDeadZone) / (1 - stickDeadZone), 0, 1);
  return Math.sign(offset) * amount * amount;
}

/** HUD controls: the mouse is reaching for them, not steering */
const overControls = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest(
    'button, a, input, .explore-hud__top, .explore-hud__dock, .explore-hud__lift, .explore-hud__waypoints'
  );

function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable]')
  );
}

/** Toggles the autopilot to the station a digit key names */
function setCourse(index: number) {
  const key = navigableStations[index];
  if (!key) return;
  setAutopilot(worldStore.autopilot === key ? '' : key);
}

/** The fog's own distances, per fog (a theme change makes a new one) */
const fogBase = new WeakMap<Fog, { near: number; far: number }>();

/** Draws the fog back while exploring, so distant stations stay in sight, and returns it after */
function reachOut(scene: Scene, exploring: boolean, lite: boolean, dt: number) {
  const fog = scene.fog;
  if (!(fog instanceof Fog)) return;
  let base = fogBase.get(fog);
  if (!base) {
    base = { near: fog.near, far: fog.far };
    fogBase.set(fog, base);
  }
  const far = exploring ? (lite ? exploreFog.liteFar : exploreFog.far) : base.far;
  const near = exploring ? exploreFog.near : base.near;
  if (Math.abs(fog.far - far) < 0.5 && Math.abs(fog.near - near) < 0.5) return;
  fog.far = MathUtils.damp(fog.far, far, 1.4, dt);
  fog.near = MathUtils.damp(fog.near, near, 1.4, dt);
  setViewRange(Math.max(115, fog.far));
}

/** Where every station's beacon sits on screen, for the HUD's waypoints */
function publishWaypoints(cam: PerspectiveCamera) {
  cam.updateMatrixWorld();
  for (const key of navigableStations) {
    station.fromArray(stationPositions[key]);
    point.copy(station).add(view.set(0, beaconHeight(key), 0));
    view.copy(point).applyMatrix4(cam.matrixWorldInverse);
    const waypoint = (worldStore.waypoints[key] ??= { x: 0, y: 0, onScreen: false, distance: 0 });
    waypoint.distance = cam.position.distanceTo(station);
    point.project(cam);
    if (view.z < 0 && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1) {
      waypoint.x = point.x;
      waypoint.y = point.y;
      waypoint.onScreen = true;
    } else {
      // Off screen: the way to turn (straight behind reads as "turn round", downwards)
      const length = Math.hypot(view.x, view.y);
      waypoint.x = length > 1e-3 ? view.x / length : 0;
      waypoint.y = length > 1e-3 ? view.y / length : -1;
      waypoint.onScreen = false;
    }
  }
}

interface LookState {
  yaw: number;
  pitch: number;
  /** Bank into the turn (radians) */
  roll: number;
  active: boolean;
  since: number;
  /** Clock time of the last bump into a hull */
  bumpedAt: number;
  /** Reduced motion: no banking, no jolts */
  calm: boolean;
}

/** A knock against a hull, `speed` units a second into it: a jolt, a flash of the HUD and a thud */
function bump(speed: number, t: number, state: LookState) {
  if (t - state.bumpedAt < 0.35) return;
  state.bumpedAt = t;
  const strength = MathUtils.clamp(speed / 30, 0.25, 1);
  worldStore.shake = Math.max(worldStore.shake, strength);
  emitCue('bump');
  window.dispatchEvent(new CustomEvent(worldBumpEvent, { detail: strength }));
}

/**
 * Autopilot: turns towards where it is going (round the station's side
 * first when coming from behind it), burns once roughly facing that way and
 * brakes to park in front of the station, turning to face it on the last
 * stretch. Returns true once it is parked and facing the station.
 */
function flyTo(key: StationKey, state: LookState, cam: PerspectiveCamera, dt: number) {
  station.fromArray(stationPositions[key]);
  goal.copy(station).add(approach);
  let left = cam.position.distanceTo(goal);
  let toward = goal;
  if (cam.position.z < station.z + 4) {
    const side = Math.sign(cam.position.x - station.x) || 1;
    point.set(station.x + side * rounding, station.y + 2, station.z + 6);
    const lap = cam.position.distanceTo(point);
    if (lap > 8) {
      toward = point;
      left = lap + point.distanceTo(goal);
    }
  }
  wish.subVectors(toward, cam.position);
  const distance = wish.length();
  const settling = toward === goal && distance < 30;
  aim.copy(settling ? station : toward).sub(cam.position);
  const yaw = state.yaw + wrap(Math.atan2(-aim.x, -aim.z) - state.yaw);
  const pitch = MathUtils.clamp(Math.atan2(aim.y, Math.hypot(aim.x, aim.z)), -1.2, 1.2);
  state.yaw += MathUtils.clamp((yaw - state.yaw) * 2.6, -autoTurn, autoTurn) * dt;
  state.pitch += MathUtils.clamp((pitch - state.pitch) * 2.6, -autoTurn, autoTurn) * dt;

  forward.set(0, 0, -1).applyEuler(euler.set(state.pitch, state.yaw, 0, 'YXZ'));
  const facing = distance > 1e-3 ? forward.dot(view.copy(wish).divideScalar(distance)) : 1;
  // Faster than it can stop in would overshoot: v² = 2·a·d
  const speed =
    Math.min(autoSpeed, Math.sqrt(2 * autoBrake * left)) *
    (settling ? 1 : MathUtils.smoothstep(facing, 0.35, 0.9));
  wish.setLength(speed);
  velocity.lerp(wish, 1 - Math.exp(-2.6 * dt));
  const aligned = Math.abs(yaw - state.yaw) < 0.05 && Math.abs(pitch - state.pitch) < 0.05;
  return settling && distance < 2 && velocity.length() < 3 && aligned;
}

/** Docking: drifts to a stop and turns to face the station while the clamps close */
function settle(key: StationKey, state: LookState, cam: PerspectiveCamera, dt: number) {
  aim.fromArray(stationPositions[key]).sub(cam.position);
  const yaw = state.yaw + wrap(Math.atan2(-aim.x, -aim.z) - state.yaw);
  const pitch = MathUtils.clamp(Math.atan2(aim.y, Math.hypot(aim.x, aim.z)), -1.2, 1.2);
  const ease = 1 - Math.exp(-3 * dt);
  state.yaw += (yaw - state.yaw) * ease;
  state.pitch += (pitch - state.pitch) * ease;
  velocity.multiplyScalar(Math.exp(-3.5 * dt));
}

export function ExploreControls() {
  const look = useRef<LookState>({
    yaw: 0,
    pitch: 0,
    roll: 0,
    active: false,
    since: 0,
    bumpedAt: -Infinity,
    calm: false,
  });
  const lite = useLite();

  // Keyboard: held keys set the axes; digits set course; Escape leaves
  useEffect(() => {
    const held = new Set<string>();
    const apply = () => {
      exploreInput.forward = 0;
      exploreInput.strafe = 0;
      exploreInput.lift = 0;
      exploreInput.turn = 0;
      for (const code of held) {
        const axis = keys.get(code);
        if (axis && axis !== 'boost' && axis !== 'lookX' && axis !== 'lookY') {
          (exploreInput[axis] as number) += negative.has(code) ? -1 : 1;
        }
      }
    };
    const down = (e: KeyboardEvent) => {
      if (worldMode.get().mode !== 'explore' || typing(e.target)) return;
      // With the pointer locked the browser takes the first Esc to free the
      // mouse; one that reaches the page leaves free roam
      if (e.key === 'Escape') {
        worldMode.exit();
        return;
      }
      if (e.key === 'Shift') exploreInput.boost = true;
      const course = digit.exec(e.code);
      if (course && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setCourse(Number(course[1]));
        return;
      }
      if (keys.has(e.code)) {
        e.preventDefault();
        held.add(e.code);
        apply();
      }
    };
    const upKey = (e: KeyboardEvent) => {
      if (e.key === 'Shift') exploreInput.boost = false;
      if (held.delete(e.code)) apply();
    };
    const blur = () => {
      held.clear();
      exploreInput.boost = false;
      apply();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', upKey);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', upKey);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // The mouse looks (locked) or steers by where it rests. Touch is the
  // thumbsticks' (ExploreHud), which steer through the same input
  useEffect(() => {
    const lockable = canLockPointer();
    let travel = 0;
    const centre = () => {
      exploreInput.steerX = 0;
      exploreInput.steerY = 0;
    };
    const down = (e: PointerEvent) => {
      if (worldMode.get().mode !== 'explore' || e.pointerType !== 'mouse') return;
      // A click on open space takes the mouse back
      if (lockable && e.button === 0 && !overControls(e.target)) lockPointer();
    };
    const move = (e: PointerEvent) => {
      if (worldMode.get().mode !== 'explore' || e.pointerType !== 'mouse') return;
      if (lockable) {
        // Free, the mouse is for the HUD; locked, every movement turns the view
        if (!document.pointerLockElement) return;
        exploreInput.lookX += e.movementX * lookSpeed;
        exploreInput.lookY += e.movementY * lookSpeed;
        if (worldStore.autopilot) {
          travel += Math.abs(e.movementX) + Math.abs(e.movementY);
          if (travel > takeOver) setAutopilot('');
        } else travel = 0;
        return;
      }
      if (overControls(e.target)) {
        centre();
        return;
      }
      exploreInput.lookX += e.movementX * nudge;
      exploreInput.lookY += e.movementY * nudge;
      exploreInput.steerX = (e.clientX / window.innerWidth) * 2 - 1;
      exploreInput.steerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const root = document.documentElement;
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: true });
    // Leaving the window (or switching away) holds course
    root.addEventListener('pointerleave', centre);
    window.addEventListener('blur', centre);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', centre);
      window.removeEventListener('blur', centre);
    };
  }, []);

  useFrame(({ camera, clock, scene }, delta) => {
    const state = look.current;
    const yawBefore = state.yaw;
    const dt = Math.min(delta, 1 / 20);
    const exploring = worldMode.get().mode === 'explore';
    reachOut(scene, exploring, lite, dt);
    if (!exploring) {
      if (state.active) {
        state.active = false;
        velocity.set(0, 0, 0);
        setDock('');
        setAutopilot('');
        setDocking('');
      }
      return;
    }
    const cam = camera as PerspectiveCamera;

    // Take over from wherever the camera was pointing. The mouse is wherever
    // the visitor clicked to start, so steering waits until it next moves
    if (!state.active) {
      state.active = true;
      state.since = clock.elapsedTime;
      state.calm = motionLevel() !== 'full';
      euler.setFromQuaternion(cam.quaternion, 'YXZ');
      state.yaw = euler.y;
      state.pitch = euler.x;
      state.roll = 0;
      velocity.set(0, 0, 0);
      exploreInput.steerX = 0;
      exploreInput.steerY = 0;
      exploreInput.lookX = 0;
      exploreInput.lookY = 0;
    }

    // Any hand on the controls takes over from the autopilot
    const manual =
      exploreInput.forward || exploreInput.strafe || exploreInput.lift || exploreInput.turn;
    if (manual && worldStore.autopilot) setAutopilot('');
    if (worldStore.docking) {
      exploreInput.lookX = 0;
      exploreInput.lookY = 0;
    }

    // Steering eases in over the first half second, so it never lurches
    const ease = MathUtils.smoothstep(clock.elapsedTime - state.since, 0, 0.5);
    const yawRate =
      (steering(exploreInput.steerX) * maxYawRate + stickTurn(exploreInput.stickX) * stickYawRate) *
        ease +
      exploreInput.turn * 1.6;
    const pitchRate =
      (steering(exploreInput.steerY) * maxPitchRate +
        stickTurn(exploreInput.stickY) * stickPitchRate) *
      ease;
    state.yaw -= exploreInput.lookX + yawRate * dt;
    state.pitch = MathUtils.clamp(state.pitch - exploreInput.lookY - pitchRate * dt, -1.35, 1.35);
    exploreInput.lookX = 0;
    exploreInput.lookY = 0;

    const course = worldStore.autopilot as StationKey | '';
    if (worldStore.docking) {
      // Docking: hands off the controls, coast to a stop facing the station
      settle(stationForPath(worldStore.docking), state, cam, dt);
    } else if (course) {
      if (flyTo(course, state, cam, dt)) setAutopilot('');
    } else {
      // Thrust along where the camera faces, with drag
      forward.set(0, 0, -1).applyEuler(euler.set(state.pitch, state.yaw, 0, 'YXZ'));
      right.crossVectors(forward, up).normalize();
      const thrust = exploreInput.boost ? 70 : 26;
      wish
        .copy(forward)
        .multiplyScalar(exploreInput.forward)
        .addScaledVector(right, exploreInput.strafe)
        .addScaledVector(up, exploreInput.lift);
      if (wish.lengthSq() > 1) wish.normalize();
      velocity.addScaledVector(wish, thrust * dt * 2.6);
      velocity.multiplyScalar(Math.exp(-2.6 * dt));
    }
    // Bank into turns (and a little into sideways drift), levelling out
    // while docking; none for reduced motion
    const turnRate = (state.yaw - yawBefore) / Math.max(dt, 1e-4);
    right.set(1, 0, 0).applyEuler(euler.set(0, state.yaw, 0, 'YXZ'));
    const drift = velocity.dot(right);
    const bank = state.calm || worldStore.docking ? 0 : turnRate * bankPerRate - drift * 0.006;
    state.roll = MathUtils.damp(state.roll, MathUtils.clamp(bank, -maxBank, maxBank), 4, dt);
    cam.quaternion.setFromEuler(euler.set(state.pitch, state.yaw, state.roll, 'YXZ'));
    cam.position.addScaledVector(velocity, dt);

    // Hulls push back (a hard knock jolts the view, flashes the HUD and
    // thuds); the edge of the world gently turns you round
    let nearest = '';
    let nearestDistance = Infinity;
    for (const key of navigableStations) {
      station.fromArray(stationPositions[key]);
      const distance = cam.position.distanceTo(station);
      if (distance < hullRadius) {
        const normal = station.sub(cam.position).normalize().negate();
        cam.position.addScaledVector(normal, hullRadius - distance);
        const into = -velocity.dot(normal);
        if (into > 0) {
          // Bounce off rather than grinding along the hull
          velocity.addScaledVector(normal, into * 1.5);
          if (into > gentle) bump(into, clock.elapsedTime, state);
        }
      }
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = key;
      }
    }
    const fromCentre = cam.position.distanceTo(centre);
    if (fromCentre > worldRadius) {
      velocity.addScaledVector(
        station.copy(centre).sub(cam.position).normalize(),
        (fromCentre - worldRadius) * dt
      );
    }
    setDock(nearestDistance < dockRange ? nearest : '');

    const speed = velocity.length();
    worldStore.velocity = speed;
    cam.fov = MathUtils.damp(cam.fov, baseFov + Math.min(speed * 0.25, 18), 4, dt);
    cam.updateProjectionMatrix();
    applyShake(cam, clock.elapsedTime, dt, state.calm);
    publishWaypoints(cam);
  });

  return null;
}
