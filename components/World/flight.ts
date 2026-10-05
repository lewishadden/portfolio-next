import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

import { stationKeys, stationPositions } from './stations';

/* ------------------------------------------------------------------
   Camera flights between stations.

   A flight is a cubic Bézier: the camera backs away from where it is
   (rising, so it clears the station it leaves), arcs over anything in
   the way and arrives along the destination's own viewing axis, so it
   never passes through a station or swings round at the last moment.
   Distance along the curve follows a smootherstep, so speed rises and
   falls without a jolt at either end.
   ------------------------------------------------------------------ */

const samples = 48;
const up = new Vector3(0, 1, 0);
const scratch = new Vector3();
const scratchB = new Vector3();
const lookMatrix = new Matrix4();

export interface Flight {
  p0: Vector3;
  p1: Vector3;
  p2: Vector3;
  p3: Vector3;
  /** Where the camera looked when the flight began */
  lookFrom: Vector3;
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

/** Closest distance from any station (other than the ends) to the curve */
function clearance(f: Flight, skip: Vector3[]) {
  let closest = Infinity;
  const point = new Vector3();
  for (let i = 1; i < samples; i++) {
    bezier(f, i / samples, point);
    for (const key of stationKeys) {
      scratch.fromArray(stationPositions[key]);
      if (skip.some((s) => s.distanceToSquared(scratch) < 400)) continue;
      closest = Math.min(closest, point.distanceTo(scratch));
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
  fromLook: Vector3,
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
    lookFrom: fromLook.clone(),
    lengths: new Float32Array(samples + 1),
    length: 0,
    duration: 0,
    elapsed: 0,
  };

  // Short hops (docking, small adjustments) barely arc
  const reach = MathUtils.clamp(distance * 0.3, 1.5, 70);
  let lift = MathUtils.clamp(distance * 0.12, 0, 26);

  // Leave by backing away from what the camera is looking at, or keep the
  // momentum of a flight already under way
  const away = new Vector3().subVectors(fromPos, fromLook).normalize();
  const arrival = new Vector3().subVectors(toPos, toLook).normalize();
  const moving = velocity.length() > 6;
  const plan = () => {
    if (moving) f.p1.copy(fromPos).addScaledVector(velocity, 0.35);
    else f.p1.copy(fromPos).addScaledVector(away, reach * 0.6);
    f.p1.addScaledVector(up, lift);
    // Arrive along the destination's viewing axis, from out in front of it
    f.p2
      .copy(toPos)
      .addScaledVector(arrival, reach)
      .addScaledVector(up, lift * 0.8);
    measure(f);
  };
  plan();

  // Lift the arc until it clears every station it would otherwise skim
  const ends = [fromLook, toLook];
  for (let i = 0; i < 4 && distance > 20 && clearance(f, ends) < 14; i++) {
    lift += 12;
    plan();
  }

  f.duration = MathUtils.clamp(1.2 + f.length / 85, 1.1, 3.6);
  return f;
}

/** Rotation that looks from `eye` at `target` (camera convention: -Z forward) */
export function lookRotation(eye: Vector3, target: Vector3, out: Quaternion) {
  lookMatrix.lookAt(eye, target, up);
  return out.setFromRotationMatrix(lookMatrix);
}
