import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

import { stationKeys, stationPositions } from './stations';

/* ------------------------------------------------------------------
   Camera flights between stations.

   A flight is a cubic Bézier: the camera rises as it leaves, arcs over
   anything in the way and settles onto the destination's viewing pose.
   Distance along the curve follows a smootherstep, so speed rises and
   falls without a jolt at either end.

   The camera's rotation is planned too, not aimed at points from
   wherever it happens to be (that swings wildly as it passes them):
   `flightRotation` blends the starting view into the destination's,
   leaning a little into the direction of travel when that is roughly
   ahead. Every station is framed looking the same way down the line,
   so a flight back towards Home never turns the camera round: it pulls
   back over the stations and settles, nose dipped to watch them go.
   ------------------------------------------------------------------ */

const samples = 48;
const up = new Vector3(0, 1, 0);
const xAxis = new Vector3(1, 0, 0);
const origin = new Vector3();
const scratch = new Vector3();
const scratchB = new Vector3();
const forward = new Vector3();
const lookMatrix = new Matrix4();
const turn = new Quaternion();

export interface Flight {
  p0: Vector3;
  p1: Vector3;
  p2: Vector3;
  p3: Vector3;
  /** The camera's rotation when the flight began */
  rotationFrom: Quaternion;
  /** Cumulative arc length at each of `samples + 1` evenly spaced curve parameters */
  lengths: Float32Array;
  length: number;
  duration: number;
  elapsed: number;
}

/** Zero velocity and acceleration at both ends */
export const smootherstep = (x: number) => {
  const t = MathUtils.clamp(x, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export function bezier(f: Flight, t: number, out: Vector3) {
  const u = 1 - t;
  return out
    .copy(f.p0)
    .multiplyScalar(u * u * u)
    .addScaledVector(f.p1, 3 * u * u * t)
    .addScaledVector(f.p2, 3 * u * t * t)
    .addScaledVector(f.p3, t * t * t);
}

export function bezierTangent(f: Flight, t: number, out: Vector3) {
  const u = 1 - t;
  out.subVectors(f.p1, f.p0).multiplyScalar(3 * u * u);
  scratchB.subVectors(f.p2, f.p1).multiplyScalar(6 * u * t);
  out.add(scratchB);
  scratchB.subVectors(f.p3, f.p2).multiplyScalar(3 * t * t);
  return out.add(scratchB);
}

function measure(f: Flight) {
  const point = new Vector3();
  const previous = f.p0.clone();
  let total = 0;
  f.lengths[0] = 0;
  for (let i = 1; i <= samples; i++) {
    bezier(f, i / samples, point);
    total += point.distanceTo(previous);
    f.lengths[i] = total;
    previous.copy(point);
  }
  f.length = total;
}

/** Curve parameter at a fraction (0..1) of the flight's arc length */
export function parameterAt(f: Flight, fraction: number) {
  const target = MathUtils.clamp(fraction, 0, 1) * f.length;
  let lo = 0;
  let hi = samples;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (f.lengths[mid] < target) lo = mid;
    else hi = mid;
  }
  const span = f.lengths[hi] - f.lengths[lo] || 1;
  return (lo + (target - f.lengths[lo]) / span) / samples;
}

/**
 * How far the curve stays outside every station's keep-out radius (negative
 * when it cuts in). The stations it leaves and reaches are framed from ~11
 * units out, so they get a tighter radius and only the stretch between the
 * ends is checked against them.
 */
function clearance(f: Flight, fromLook: Vector3, toLook: Vector3) {
  let closest = Infinity;
  const point = new Vector3();
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    bezier(f, t, point);
    for (const key of stationKeys) {
      scratch.fromArray(stationPositions[key]);
      const isFrom = scratch.distanceToSquared(fromLook) < 400;
      const isTo = scratch.distanceToSquared(toLook) < 400;
      if ((isFrom && t < 0.04) || (isTo && t > 0.96)) continue;
      const radius = isFrom || isTo ? 8 : 14;
      closest = Math.min(closest, point.distanceTo(scratch) - radius);
    }
  }
  return closest;
}

/**
 * Plans a flight from the camera's current pose to a destination pose.
 * `velocity` (world units per second) carries momentum into the new flight
 * when the camera is retargeted mid-flight.
 */
export function planFlight(
  fromPos: Vector3,
  fromRotation: Quaternion,
  toPos: Vector3,
  toLook: Vector3,
  velocity: Vector3
): Flight | null {
  const distance = fromPos.distanceTo(toPos);
  if (distance < 0.25) return null;

  const f: Flight = {
    p0: fromPos.clone(),
    p1: new Vector3(),
    p2: new Vector3(),
    p3: toPos.clone(),
    rotationFrom: fromRotation.clone(),
    lengths: new Float32Array(samples + 1),
    length: 0,
    duration: 0,
    elapsed: 0,
  };

  // Short hops (docking, small adjustments) barely arc
  const reach = MathUtils.clamp(distance * 0.3, 1.5, 70);
  let lift = MathUtils.clamp(distance * 0.1, 0, 22);

  const toward = new Vector3().subVectors(toPos, fromPos).normalize();
  const viewFrom = new Vector3(0, 0, -1).applyQuaternion(fromRotation);
  const fromLook = fromPos.clone().addScaledVector(viewFrom, 12);
  const arrival = new Vector3().subVectors(toPos, toLook).normalize();
  // Arrive along the destination's viewing axis when travelling the way it
  // faces; flying back against it, settle while still drifting back (turning
  // round to come in head-first is what used to send the camera into a spin)
  const ahead = -toward.dot(arrival);
  const arrive = MathUtils.lerp(-0.3, 1, MathUtils.smoothstep(ahead, -0.3, 0.5));
  const moving = velocity.length() > 6;

  const plan = () => {
    // Head off towards the destination, easing back from the view, and climb
    if (moving) f.p1.copy(fromPos).addScaledVector(velocity, 0.35);
    else {
      f.p1
        .copy(fromPos)
        .addScaledVector(toward, reach * 0.4)
        .addScaledVector(viewFrom, -reach * 0.2);
    }
    f.p1.addScaledVector(up, lift);
    f.p2
      .copy(toPos)
      .addScaledVector(arrival, reach * arrive)
      .addScaledVector(up, lift * 0.8);
    measure(f);
  };
  plan();

  // Raise the arc until it clears every station it would otherwise skim
  for (let i = 0; i < 6 && distance > 20 && clearance(f, fromLook, toLook) < 0; i++) {
    lift += 8;
    plan();
  }

  f.duration = MathUtils.clamp(1.2 + f.length / 85, 1.1, 3.6);
  return f;
}

/** Per-flight state `flightRotation` carries from frame to frame */
export interface FlightView {
  /** Direction of travel, smoothed so tight bends never whip the view */
  ahead: Vector3;
  started: boolean;
}

/**
 * The camera's rotation `s` (0..1) of the way through a flight: the start
 * view blended into `rotationTo`, leaning into the direction of travel
 * mid-flight when that is roughly ahead, or dipping the nose a touch when
 * the camera is pulling back.
 */
export function flightRotation(
  f: Flight,
  view: FlightView,
  s: number,
  u: number,
  rotationTo: Quaternion,
  dt: number,
  out: Quaternion
) {
  out.copy(f.rotationFrom).slerp(rotationTo, smootherstep((s - 0.08) / 0.8));

  bezierTangent(f, u, scratch);
  if (scratch.lengthSq() > 1e-8) {
    scratch.normalize();
    if (!view.started) view.ahead.copy(scratch);
    else view.ahead.lerp(scratch, 1 - Math.exp(-5 * dt)).normalize();
    view.started = true;
  }

  forward.set(0, 0, -1).applyQuaternion(out);
  const along = forward.dot(view.ahead);
  const swell = Math.sin(Math.PI * s) ** 2;
  const lean = 0.35 * MathUtils.smoothstep(along, 0.1, 0.8) * swell;
  if (lean > 1e-4) out.slerp(lookRotation(origin, view.ahead, turn), lean);
  const dip = 0.2 * MathUtils.smoothstep(-along, 0.2, 0.8) * swell;
  if (dip > 1e-4) out.multiply(turn.setFromAxisAngle(xAxis, -dip));
  return out;
}

/** Rotation that looks from `eye` at `target` (camera convention: -Z forward) */
export function lookRotation(eye: Vector3, target: Vector3, out: Quaternion) {
  lookMatrix.lookAt(eye, target, up);
  return out.setFromRotationMatrix(lookMatrix);
}
