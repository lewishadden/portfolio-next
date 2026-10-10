'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CatmullRomCurve3, Euler, Fog, MathUtils, PerspectiveCamera, Vector3 } from 'three';

import { motionLevel } from '@/utils/motion';

import { colliderCount, contactWith, shipMargin } from './colliders';
import {
  aimingReticle,
  clickTarget,
  refreshPointer,
  releaseHover,
  reticleFreed,
} from './interaction';
import { spawnPing } from './Pings';
import { cometAt, signals } from './signalStore';
import { canLockPointer, lockPointer } from './pointerLock';
import {
  navigableStations,
  sectorCentre,
  sectorRadius,
  stationForPath,
  stationKeys,
} from './routes';
import { applyShake } from './shake';
import { spawnSparks } from './Sparks';
import { fogTarget, setViewRange, useLite } from './stationHooks';
import { baseFov, beaconHeight, stationPositions } from './stations';
import { worldMode } from './worldMode';
import {
  emitCue,
  exploreInput,
  setAutopilot,
  setDock,
  setDocking,
  worldBumpEvent,
  worldScanEvent,
  worldStore,
} from './worldStore';

import type { RootState } from '@react-three/fiber';
import type { Scene } from 'three';
import type { Contact } from './colliders';
import type { StationKey } from './routes';
import type { Signal } from './signalStore';

/* ------------------------------------------------------------------
   Free flight. While the world is in explore mode the visitor flies the
   camera: keys or the on-screen pad to move, and the mouse steers (R / V
   and PageUp / PageDown tip the nose too). The pointer is locked, so the
   cursor stays in the middle of the screen and
   every movement turns the view at once, like a flight sim (Esc frees
   the mouse for the HUD; a click takes it back). Where the pointer can't
   be locked, the further the mouse rests from the centre the faster the
   view turns that way. Touch gets twin thumbsticks instead (ExploreHud):
   one flies, the other turns the view the way it is held.

   Finding your way: the fog draws back so distant stations stay in
   sight, the HUD marks every station (edge arrows for those off screen),
   and the number keys (or a click on a marker) set the autopilot, which
   turns, flies and brakes to park in front of that station (or a little
   short of a signal, for a 'signal:<id>' course). Flying close
   to a station offers to dock, which opens its page (the camera rig then
   flies the last stretch in). Hulls, and simple solids standing in for
   the experience beam, the projects helix, the derelict and the signal
   craft (colliders.ts), push you back out rather than letting you clip
   inside them. The edge of the world (sectorRadius) turns you back.
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
  ['KeyR', 'pitch'],
  ['PageUp', 'pitch'],
  ['KeyV', 'pitch'],
  ['PageDown', 'pitch'],
]);
const negative = new Set(['KeyS', 'ArrowDown', 'KeyA', 'ArrowLeft', 'KeyC', 'KeyV', 'PageDown']);
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
const centre = new Vector3(...sectorCentre);
const outward = new Vector3();

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
/** Fastest a bump into a hull can be met without a jolt (units per second) */
const gentle = 3;
/** Steepest bank into a turn (radians), and how much each radian a second of turning banks */
const maxBank = 0.3;
const bankPerRate = 0.13;
/** Pitch keys: how fast they tip the nose (rad/s) */
const pitchRate = 1.1;
/** Past the edge of the world (sectorRadius): how fast the ship is drawn back in, per unit beyond it (1/s) */
const edgeSpring = 3;
/** However it got there (a long frame, a hull pushing it out), the ship is never further past the edge than this */
const edgeSlack = 4;
/** The edge shimmers into view (worldStore.edge) over this much of the way to it */
const edgeWarning = 60;
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
/** Autopilot: points along the course it publishes for the radar and the course line */
const courseSamples = 26;
/**
 * Autopilot to something on the move (the comet): the course is planned
 * again once its goal is this far from where the course ends (units), at
 * most every `replanEvery` seconds
 */
const courseDrift = 4;
const replanEvery = 0.5;
/**
 * Autopilot to a signal ('signal:<id>'): parks this far short of it, on
 * the ship's side (further from the derelict, whose wreck spreads wide)
 */
const standOff = 6;
const standOffFor: Partial<Record<Signal['id'], number>> = { derelict: 9 };
/** Free roam: how far ahead the reticle picks things out (world units), and every how many frames it looks */
const reach = 60;
const aimEvery = 3;

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
    'button, a, input, .explore-hud__top, .explore-hud__coach, .explore-hud__autopilot, .explore-hud__signal, .explore-hud__dock, .explore-hud__lift, .explore-hud__waypoints'
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
  // Outside free roam: the fog's own, or drawn back while a flight is under way (fogTarget)
  const settled = exploring ? null : fogTarget(base, lite);
  const far = settled ? settled.far : lite ? exploreFog.liteFar : exploreFog.far;
  const near = settled ? settled.near : exploreFog.near;
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
  /** Motion below full (calm or still): no banking, no jolts */
  calm: boolean;
  /** Frames since free roam began, for looking again under the reticle every few */
  frames: number;
  /** The reticle aimed last frame (the pointer was locked) */
  aiming: boolean;
  /** The course worldStore.autopilotPath was planned for ('' for none), and when (clock time) */
  planned: string;
  plannedAt: number;
  /** Colliders the camera started free roam inside (colliders.ts): not enforced until it leaves them */
  excused: Set<number>;
}

/**
 * What is under the pointer is looked at again every few frames as the
 * ship flies (under the reticle when the pointer is locked), no further
 * than `reach`; outside free roam the raycaster reaches as far as it can
 */
function aimReticle(state: RootState, look: LookState) {
  if (state.raycaster.far !== reach) state.raycaster.far = reach;
  const aiming = aimingReticle();
  // The mouse was freed: a hover only the reticle could end lets go now
  if (look.aiming && !aiming) reticleFreed(state);
  look.aiming = aiming;
  look.frames++;
  if (look.frames % aimEvery === 0) refreshPointer(state);
}

/** Free roam is over: hovers made under the reticle end, and the raycaster reaches as far as it can */
function stopAiming(state: RootState, look: LookState) {
  state.raycaster.far = Infinity;
  look.aiming = false;
  releaseHover(state);
}

/** A knock against a hull, `speed` units a second into it: a jolt, a flash of the HUD and a thud */
function bump(speed: number, t: number, state: LookState, hit: Contact, incoming: Vector3) {
  if (t - state.bumpedAt < 0.35) return;
  state.bumpedAt = t;
  const strength = MathUtils.clamp(speed / 30, 0.25, 1);
  worldStore.shake = Math.max(worldStore.shake, strength);
  emitCue('bump', { at: [hit.point.x, hit.point.y, hit.point.z], strength });
  window.dispatchEvent(new CustomEvent(worldBumpEvent, { detail: strength }));
  // A ring of light where the hull was struck, and sparks off it (full
  // motion). The thud is its sound: the ring doesn't chime as a click's does
  spawnPing(hit.point, { cue: false });
  spawnSparks(hit.point, hit.normal, incoming, strength);
}

const contact: Contact = { normal: new Vector3(), gap: 0, point: new Vector3() };
/** The ship's velocity going into a hull, before it bounced */
const incoming = new Vector3();

/** Colliders the ship is already inside as free roam starts: left alone until it is clear of them */
function excuseColliders(position: Vector3, t: number, state: LookState) {
  state.excused.clear();
  for (let i = 0; i < colliderCount; i++) {
    if (contactWith(i, position, t, contact)) state.excused.add(i);
  }
}

/** Pushes the ship back out of anything it has flown into, bouncing off rather than grinding along */
function collide(cam: PerspectiveCamera, t: number, state: LookState) {
  for (let i = 0; i < colliderCount; i++) {
    if (!contactWith(i, cam.position, t, contact)) {
      state.excused.delete(i);
      continue;
    }
    if (state.excused.has(i)) continue;
    cam.position.addScaledVector(contact.normal, shipMargin - contact.gap);
    const into = -velocity.dot(contact.normal);
    if (into <= 0) continue;
    incoming.copy(velocity);
    velocity.addScaledVector(contact.normal, into * 1.5);
    if (into > gentle) bump(into, t, state, contact, incoming);
  }
}

/**
 * Autopilot: coming from behind a station (`from` on its far side), the
 * course first rounds its side, `rounding` out, until within 8 units of
 * that point. True when it does; `out` is then the point to round
 */
function roundsSide(from: Vector3, at: Vector3, out: Vector3) {
  if (from.z >= at.z + 4) return false;
  const side = Math.sign(from.x - at.x) || 1;
  out.set(at.x + side * rounding, at.y + 2, at.z + 6);
  return from.distanceTo(out) > 8;
}

const isStation = (course: string): course is StationKey =>
  (stationKeys as readonly string[]).includes(course);

/**
 * Where a course leads, seen from `from`: into `station` (what to face on
 * arrival) and `goal` (where to park). A station key parks in front of the
 * station; 'signal:<id>' parks a little short of that signal on the ship's
 * side (the comet followed along its orbit, `t` the clock). Which it is,
 * or null for a course that leads nowhere
 */
function resolveCourse(course: string, from: Vector3, t: number): 'station' | 'signal' | null {
  if (isStation(course)) {
    station.fromArray(stationPositions[course]);
    goal.copy(station).add(approach);
    return 'station';
  }
  const signal = course.startsWith('signal:')
    ? signals.find((s) => s.id === course.slice('signal:'.length))
    : undefined;
  if (!signal) return null;
  if (signal.id === 'comet') cometAt(t, station);
  else station.fromArray(signal.position);
  goal.subVectors(from, station);
  if (goal.lengthSq() < 1e-6) goal.set(0, 0, 1);
  goal.setLength(standOffFor[signal.id] ?? standOff).add(station);
  return 'signal';
}

const coursePoints = [new Vector3(), new Vector3(), new Vector3()];
const noCourse = new Float32Array(0);

/**
 * The autopilot's course, as the radar and the course line draw it: from
 * the camera, round the station's side if flyTo will, to where it parks.
 * `courseSamples` points (x, y, z triples) along a curve through them
 */
function planCourse(course: string, from: Vector3, t: number) {
  const kind = resolveCourse(course, from, t);
  if (!kind) return noCourse;
  const [start, round, end] = coursePoints;
  start.copy(from);
  end.copy(goal);
  const rounds = kind === 'station' && roundsSide(from, station, round);
  const curve = new CatmullRomCurve3(
    rounds ? [start, round, end] : [start, end],
    false,
    'centripetal'
  );
  const path = new Float32Array(courseSamples * 3);
  for (let i = 0; i < courseSamples; i++) {
    curve.getPointAt(i / (courseSamples - 1), point).toArray(path, i * 3);
  }
  return path;
}

/**
 * Keeps worldStore.autopilotPath in step with the autopilot: planned when a
 * course is set (a new array, so whoever draws it sees the change), and
 * again from where the ship is as a signal's goal moves off the end of it
 * (the comet flies on along its orbit), emptied when the autopilot hands
 * back the controls
 */
function trackCourse(course: string, from: Vector3, t: number, state: LookState) {
  if (course !== state.planned) {
    state.planned = course;
    state.plannedAt = t;
    worldStore.autopilotPath = course ? planCourse(course, from, t) : noCourse;
    return;
  }
  const path = worldStore.autopilotPath;
  if (!course.startsWith('signal:') || path.length < 3 || t - state.plannedAt < replanEvery) return;
  if (resolveCourse(course, from, t) !== 'signal') return;
  if (goal.distanceToSquared(point.fromArray(path, path.length - 3)) < courseDrift ** 2) return;
  state.plannedAt = t;
  worldStore.autopilotPath = planCourse(course, from, t);
}

/**
 * Autopilot: turns towards where it is going (round the station's side
 * first when coming from behind it), burns once roughly facing that way and
 * brakes to park in front of the station (or short of the signal), turning
 * to face it on the last stretch. Returns true once it is parked and facing
 * it, or at once for a course that leads nowhere.
 */
function flyTo(course: string, state: LookState, cam: PerspectiveCamera, t: number, dt: number) {
  const kind = resolveCourse(course, cam.position, t);
  // Nowhere to go: hand the controls back
  if (!kind) return true;
  let left = cam.position.distanceTo(goal);
  let toward = goal;
  if (kind === 'station' && roundsSide(cam.position, station, point)) {
    toward = point;
    left = cam.position.distanceTo(point) + point.distanceTo(goal);
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
  // A signal can be on the move (the comet): close by and facing it is arrived
  const still = kind === 'signal' || velocity.length() < 3;
  return settling && distance < 2 && still && aligned;
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
    frames: 0,
    aiming: false,
    planned: '',
    plannedAt: 0,
    excused: new Set(),
  });
  const lite = useLite();
  const get = useThree((s) => s.get);

  // Keyboard: held keys set the axes; digits set course; Escape leaves
  useEffect(() => {
    const held = new Set<string>();
    const apply = () => {
      exploreInput.forward = 0;
      exploreInput.strafe = 0;
      exploreInput.lift = 0;
      exploreInput.turn = 0;
      exploreInput.pitch = 0;
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
      const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
      // E clicks what the reticle (or the free pointer) is on
      if (e.code === 'KeyE' && plain) {
        if (!e.repeat && clickTarget(get())) e.preventDefault();
        return;
      }
      // F asks for a sonar scan (the signals listen for it)
      if (e.code === 'KeyF' && plain) {
        e.preventDefault();
        if (!e.repeat) window.dispatchEvent(new CustomEvent(worldScanEvent));
        return;
      }
      const course = digit.exec(e.code);
      if (course && plain) {
        e.preventDefault();
        setCourse(Number(course[1]));
        return;
      }
      // With Cmd, Ctrl or Alt it is the browser's (Cmd+R reloads), not a flight key
      if (keys.has(e.code) && plain) {
        e.preventDefault();
        held.add(e.code);
        apply();
      }
    };
    const upKey = (e: KeyboardEvent) => {
      if (e.key === 'Shift') exploreInput.boost = false;
      // macOS never sends the keyup of a key let go while Cmd is down, so
      // letting go of Cmd lets go of them all rather than leave one stuck
      if (e.key === 'Meta' && held.size) {
        held.clear();
        apply();
        return;
      }
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
  }, [get]);

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

  useFrame((root, delta) => {
    const { camera, clock, scene } = root;
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
        stopAiming(root, state);
        trackCourse('', camera.position, clock.elapsedTime, state);
        worldStore.edge = 0;
      }
      return;
    }
    const cam = camera as PerspectiveCamera;

    // Take over from wherever the camera was pointing. The mouse is wherever
    // the visitor clicked to start, so steering waits until it next moves
    if (!state.active) {
      state.active = true;
      state.since = clock.elapsedTime;
      euler.setFromQuaternion(cam.quaternion, 'YXZ');
      state.yaw = euler.y;
      state.pitch = euler.x;
      state.roll = 0;
      state.aiming = false;
      velocity.set(0, 0, 0);
      exploreInput.steerX = 0;
      exploreInput.steerY = 0;
      exploreInput.lookX = 0;
      exploreInput.lookY = 0;
      // Free roam starts wherever the page left the camera, which can be
      // closer to a craft than the ship is held: no shove out on the first frame
      excuseColliders(cam.position, clock.elapsedTime, state);
    }

    // Read every frame, so a change of level applies mid-flight
    state.calm = motionLevel() !== 'full';

    // Any hand on the controls takes over from the autopilot
    const manual =
      exploreInput.forward ||
      exploreInput.strafe ||
      exploreInput.lift ||
      exploreInput.turn ||
      exploreInput.pitch;
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
    const steerPitch =
      (steering(exploreInput.steerY) * maxPitchRate +
        stickTurn(exploreInput.stickY) * stickPitchRate) *
      ease;
    state.yaw -= exploreInput.lookX + yawRate * dt;
    state.pitch = MathUtils.clamp(
      state.pitch - exploreInput.lookY - steerPitch * dt + exploreInput.pitch * pitchRate * dt,
      -1.35,
      1.35
    );
    exploreInput.lookX = 0;
    exploreInput.lookY = 0;

    const course = worldStore.autopilot;
    trackCourse(course, cam.position, clock.elapsedTime, state);
    if (worldStore.docking) {
      // Docking: hands off the controls, coast to a stop facing the station
      settle(stationForPath(worldStore.docking), state, cam, dt);
    } else if (course) {
      if (flyTo(course, state, cam, clock.elapsedTime, dt)) setAutopilot('');
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
    // The edge of the world turns you back. Past it the ship only heads back
    // in, the further out the faster. Done before it moves: thrust added
    // this frame would otherwise carry it on out before being taken away
    let fromCentre = cam.position.distanceTo(centre);
    if (fromCentre > sectorRadius) {
      outward.subVectors(cam.position, centre).divideScalar(fromCentre);
      const leaving = velocity.dot(outward);
      const allowed = -(fromCentre - sectorRadius) * edgeSpring;
      if (leaving > allowed) velocity.addScaledVector(outward, allowed - leaving);
    }
    cam.position.addScaledVector(velocity, dt);

    // Hulls (and the proxies round beams, helices and craft) push back: a
    // hard knock jolts the view, flashes the HUD and thuds
    collide(cam, clock.elapsedTime, state);
    // A last stop just past the edge, well short of its shimmer (EdgeShimmer)
    fromCentre = cam.position.distanceTo(centre);
    if (fromCentre > sectorRadius + edgeSlack) {
      outward.subVectors(cam.position, centre).divideScalar(fromCentre);
      cam.position.copy(centre).addScaledVector(outward, sectorRadius + edgeSlack);
      const leaving = velocity.dot(outward);
      if (leaving > 0) velocity.addScaledVector(outward, -leaving);
      fromCentre = sectorRadius + edgeSlack;
    }
    let nearest = '';
    let nearestDistance = Infinity;
    for (const key of navigableStations) {
      const distance = cam.position.distanceTo(station.fromArray(stationPositions[key]));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = key;
      }
    }
    worldStore.edge = MathUtils.smoothstep(fromCentre, sectorRadius - edgeWarning, sectorRadius);
    setDock(nearestDistance < dockRange ? nearest : '');

    const speed = velocity.length();
    worldStore.velocity = speed;
    cam.fov = MathUtils.damp(cam.fov, baseFov + Math.min(speed * 0.25, 18), 4, dt);
    cam.updateProjectionMatrix();
    applyShake(cam, clock.elapsedTime, dt, state.calm);
    publishWaypoints(cam);
    aimReticle(root, state);
  });

  return null;
}
