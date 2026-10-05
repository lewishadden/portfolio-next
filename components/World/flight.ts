import {
  CatmullRomCurve3,
  CubicBezierCurve3,
  Euler,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';

import { stationKeys, stationPositions } from './stations';

import type { Curve } from 'three';

/* ------------------------------------------------------------------
   Camera flights between stations.

   Every station is framed looking the same way down the line, so a
   flight is one of two manoeuvres:

   Ahead (the destination is roughly the way the camera faces): a cubic
   Bézier that rises as it leaves, arcs over anything in the way and
   settles onto the destination's viewing pose. The rotation is planned,
   not aimed at points from wherever the camera happens to be (that
   swings wildly as it passes them): the starting view blends into the
   destination's, leaning a little into the direction of travel.

   About-turn (the destination is behind): the camera swings out to one
   side and turns that way to face the station, runs past it on that
   side, loops round its front at a walk and comes in along its viewing
   axis, so the station ends dead ahead. The view chases the station's
   bearing through a rate-limited servo, so the whole flight is one
   continuous turn (about 360 degrees) that never exceeds ~95 deg/s.

   Distance along either path follows a smootherstep, so speed rises and
   falls without a jolt at either end; about-turns front-load it so the
   pass and the loop come slowly.
   ------------------------------------------------------------------ */

const samples = 64;
const up = new Vector3(0, 1, 0);
const xAxis = new Vector3(1, 0, 0);
const origin = new Vector3();
const scratch = new Vector3();
const forward = new Vector3();
const lookMatrix = new Matrix4();
const turn = new Quaternion();
const euler = new Euler(0, 0, 0, 'YXZ');

/** Behind, more or less: the destination lies against the way the camera faces */
const aboutTurnBeyond = -0.25;
/** Radius of the loop round the destination's front; the run past it sits twice that out */
const loopRadius = 24;
/** The servo chasing the station's bearing: rad/s cap, gain per second, ease-in share of the flight */
const servoCap = 1.65;
const servoGain = 2.4;
const servoEaseIn = 0.12;

export interface Flight {
  curve: Curve<Vector3>;
  /** Where the path ends (the destination pose when the flight was planned) */
  end: Vector3;
  /** The camera's rotation when the flight began */
  rotationFrom: Quaternion;
  about: boolean;
  /** About-turns: the station the camera keeps in view, and the side the path swings out to */
  focus: Vector3;
  side: Vector3;
  length: number;
  duration: number;
  elapsed: number;
}

/** Per-flight state `flightRotation` carries from frame to frame */
export interface FlightView {
  started: boolean;
  /** Direction of travel, smoothed so tight bends never whip the view */
  ahead: Vector3;
  /** About-turns: the view's yaw and pitch, and the unwrapped bearing they chase */
  yaw: number;
  pitch: number;
  targetYaw: number;
}

export const createFlightView = (): FlightView => ({
  started: false,
  ahead: new Vector3(),
  yaw: 0,
  pitch: 0,
  targetYaw: 0,
});

/** Zero velocity and acceleration at both ends */
export const smootherstep = (x: number) => {
  const t = MathUtils.clamp(x, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Shortest signed angle from `a` to `b` */
const wrap = (angle: number) => MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;

/** Share of the path covered `s` (0..1) of the way through the flight */
export function flightEase(f: Flight, s: number) {
  return Math.min(smootherstep(f.about ? Math.pow(s, 0.65) : s), 1);
}

export function flightPosition(f: Flight, s: number, out: Vector3) {
  return out.copy(f.curve.getPointAt(flightEase(f, s)));
}

/**
 * How far a path stays outside every station's keep-out radius (negative
 * when it cuts in). The stations it leaves and reaches are framed from ~11
 * units out, so they get a tighter radius and only the stretch between the
 * ends is checked against them.
 */
function clearance(curve: Curve<Vector3>, fromLook: Vector3, toLook: Vector3) {
  let closest = Infinity;
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const point = curve.getPoint(t);
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

function planAhead(
  fromPos: Vector3,
  fromLook: Vector3,
  viewFrom: Vector3,
  toPos: Vector3,
  toLook: Vector3,
  velocity: Vector3,
  ahead: number
) {
  const distance = fromPos.distanceTo(toPos);
  // Short hops (docking, small adjustments) barely arc
  const reach = MathUtils.clamp(distance * 0.3, 1.5, 70);
  let lift = MathUtils.clamp(distance * 0.1, 0, 22);
  const toward = new Vector3().subVectors(toPos, fromPos).normalize();
  const arrival = new Vector3().subVectors(toPos, toLook).normalize();
  // Arrive along the destination's viewing axis when travelling the way it
  // faces; crossing the line, settle while still drifting
  const arrive = MathUtils.lerp(-0.3, 1, MathUtils.smoothstep(ahead, -0.3, 0.5));
  const moving = velocity.length() > 6;

  const build = () => {
    // Head off towards the destination, easing back from the view, and climb
    const p1 = fromPos.clone();
    if (moving) p1.addScaledVector(velocity, 0.35);
    else p1.addScaledVector(toward, reach * 0.4).addScaledVector(viewFrom, -reach * 0.2);
    p1.addScaledVector(up, lift);
    const p2 = toPos
      .clone()
      .addScaledVector(arrival, reach * arrive)
      .addScaledVector(up, lift * 0.8);
    const curve = new CubicBezierCurve3(fromPos.clone(), p1, p2, toPos.clone());
    curve.arcLengthDivisions = 200;
    return curve;
  };
  let curve = build();
  // Raise the arc until it clears every station it would otherwise skim
  for (let i = 0; i < 6 && distance > 20 && clearance(curve, fromLook, toLook) < 0; i++) {
    lift += 8;
    curve = build();
  }
  return curve;
}

function planAbout(
  fromPos: Vector3,
  fromLook: Vector3,
  fromRotation: Quaternion,
  toPos: Vector3,
  toLook: Vector3
) {
  const distance = fromPos.distanceTo(toPos);
  const toward = new Vector3().subVectors(toPos, fromPos).normalize();
  const arrival = new Vector3().subVectors(toPos, toLook).normalize();
  // Swing out to the side away from the destination and keep turning that
  // way the whole flight: one continuous turn, never a reversal
  const right = new Vector3(1, 0, 0).applyQuaternion(fromRotation);
  right.y = 0;
  right.normalize();
  const lateral = new Vector3().subVectors(toLook, fromPos).dot(right);
  const side = right.multiplyScalar(lateral > 0 ? -1 : 1);
  let lift = MathUtils.clamp(distance * 0.06, 0, 14);

  const r = loopRadius;
  const build = () => {
    const centre = toPos.clone().addScaledVector(side, r).addScaledVector(arrival, r);
    const arc = (deg: number, h: number) =>
      centre
        .clone()
        .addScaledVector(side, r * Math.cos((deg * Math.PI) / 180))
        .addScaledVector(arrival, r * Math.sin((deg * Math.PI) / 180))
        .addScaledVector(up, h);
    const runIn = toPos
      .clone()
      .addScaledVector(side, 2 * r)
      .addScaledVector(arrival, -r * 1.2)
      .addScaledVector(up, lift * 0.5);
    const points = [fromPos.clone()];
    // Out to the side on the way, when there is room for it
    if (fromPos.distanceTo(runIn) > 3 * r) {
      points.push(
        fromPos
          .clone()
          .addScaledVector(toward, 0.3 * distance)
          .addScaledVector(side, MathUtils.clamp(0.1 * distance, 8, 22))
          .addScaledVector(up, lift)
      );
    }
    points.push(runIn);
    // Past the station, round its front and in along its viewing axis
    for (let deg = 0; deg <= 180; deg += 30) points.push(arc(deg, lift * 0.25 * (1 - deg / 180)));
    points.push(toPos.clone());
    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    curve.arcLengthDivisions = 400;
    return curve;
  };
  let curve = build();
  for (let i = 0; i < 6 && clearance(curve, fromLook, toLook) < 0; i++) {
    lift += 8;
    curve = build();
  }
  return { curve, side };
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

  const viewFrom = new Vector3(0, 0, -1).applyQuaternion(fromRotation);
  const fromLook = fromPos.clone().addScaledVector(viewFrom, 12);
  const toward = new Vector3().subVectors(toPos, fromPos).normalize();
  const arrival = new Vector3().subVectors(toPos, toLook).normalize();
  // Travelling the way the destination faces (positive) or against it
  const ahead = -toward.dot(arrival);
  const about = ahead < aboutTurnBeyond && distance > 30;

  const f: Flight = {
    curve: new CubicBezierCurve3(),
    end: toPos.clone(),
    rotationFrom: fromRotation.clone(),
    about,
    focus: toLook.clone(),
    side: new Vector3(1, 0, 0),
    length: 0,
    duration: 0,
    elapsed: 0,
  };
  if (about) {
    const plan = planAbout(fromPos, fromLook, fromRotation, toPos, toLook);
    f.curve = plan.curve;
    f.side = plan.side;
    f.length = f.curve.getLength();
    f.duration = MathUtils.clamp(1.4 + f.length / 50, 2, 6.5);
  } else {
    f.curve = planAhead(fromPos, fromLook, viewFrom, toPos, toLook, velocity, ahead);
    f.length = f.curve.getLength();
    f.duration = MathUtils.clamp(1.2 + f.length / 85, 1.1, 3.6);
  }
  return f;
}

/** Yaw and pitch of a rotation (camera convention: yaw 0 looks down -Z) */
function yawPitch(q: Quaternion) {
  euler.setFromQuaternion(q, 'YXZ');
  return { yaw: euler.y, pitch: euler.x };
}

/**
 * The camera's rotation `s` (0..1) of the way through a flight.
 * Ahead: the start view blended into `rotationTo`, leaning into the
 * direction of travel mid-flight when that is roughly ahead, or dipping the
 * nose a touch when the camera is drifting back.
 * About-turn: the view chases the station's bearing (unwrapped frame to
 * frame, so it never jumps as the bearing crosses the seam), turning the way
 * the path swings out, at a capped rate; the last stretch settles it onto
 * the destination's pose, which looks at the same station.
 */
export function flightRotation(
  f: Flight,
  view: FlightView,
  s: number,
  position: Vector3,
  rotationTo: Quaternion,
  dt: number,
  out: Quaternion
) {
  if (f.about) {
    const bearing = yawPitch(lookRotation(position, f.focus, turn));
    if (!view.started) {
      view.started = true;
      const from = yawPitch(f.rotationFrom);
      view.yaw = from.yaw;
      view.pitch = from.pitch;
      const sideYaw = yawPitch(lookRotation(origin.set(0, 0, 0), f.side, turn)).yaw;
      const turnDir = Math.sign(wrap(sideYaw - from.yaw)) || 1;
      let dyaw = wrap(bearing.yaw - from.yaw);
      if (Math.sign(dyaw) !== turnDir) dyaw -= Math.sign(dyaw) * Math.PI * 2;
      view.targetYaw = from.yaw + dyaw;
    } else {
      view.targetYaw += wrap(bearing.yaw - view.targetYaw);
    }
    const cap = servoCap * MathUtils.smoothstep(s, 0, servoEaseIn);
    view.yaw += MathUtils.clamp((view.targetYaw - view.yaw) * servoGain, -cap, cap) * dt;
    view.pitch +=
      MathUtils.clamp((bearing.pitch - view.pitch) * servoGain, -cap * 0.6, cap * 0.6) * dt;
    out.setFromEuler(euler.set(view.pitch, view.yaw, 0, 'YXZ'));
    return out.slerp(rotationTo, smootherstep((s - 0.85) / 0.15));
  }

  out.copy(f.rotationFrom).slerp(rotationTo, smootherstep((s - 0.08) / 0.8));

  scratch.copy(f.curve.getTangentAt(flightEase(f, s)));
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
  if (lean > 1e-4) out.slerp(lookRotation(origin.set(0, 0, 0), view.ahead, turn), lean);
  const dip = 0.2 * MathUtils.smoothstep(-along, 0.2, 0.8) * swell;
  if (dip > 1e-4) out.multiply(turn.setFromAxisAngle(xAxis, -dip));
  return out;
}

/** Rotation that looks from `eye` at `target` (camera convention: -Z forward) */
export function lookRotation(eye: Vector3, target: Vector3, out: Quaternion) {
  lookMatrix.lookAt(eye, target, up);
  return out.setFromRotationMatrix(lookMatrix);
}
