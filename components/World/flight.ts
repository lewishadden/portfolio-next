import { CubicBezierCurve3, Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

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

   About-turn (the destination is behind): one long sweeping arc. The
   path bows out to one side from the start, passes the station on that
   side and curls round onto its front. The camera turns to face the
   station as it pulls away and keeps it in view the whole way, so as
   the arc rounds the station the view turns back the other way onto its
   front: two opposite half turns, never a full spin.

   Distance along the path eases in and out, so speed rises and falls
   without a jolt at either end; about-turns gather speed slowly while
   they turn, and brake early with a long slow tail so they round the
   station slowly rather than whipping past it.
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
/** About-turns: how far out to the side the arc curls in from, level with the destination pose */
const curlOut = 34;
/** About-turns: seconds spent turning to face the station, and rounding it at the end */
const departTime = 3;
const roundTime = 3;
/** About-turns: path left as it starts rounding the station (it is slow by then) */
const roundReach = 34;
/** How quickly (per second) the about-turn's view follows the station's bearing */
const bearingFollow = 9;
/** Steepest the camera pitches to keep the station in view */
const maxPitch = 0.3;

export interface Flight {
  curve: Curve<Vector3>;
  /** Where the path ends (the destination pose when the flight was planned) */
  end: Vector3;
  /** The camera's rotation when the flight began */
  rotationFrom: Quaternion;
  about: boolean;
  /**
   * About-turns: when speed stops building, braking begins, the turn to
   * face the station ends and the arc starts rounding it (shares of the flight)
   */
  accel: number;
  brake: number;
  departEnd: number;
  roundFrom: number;
  /** About-turns: the station the camera keeps in view, and which way (+1 left, -1 right) it first turns */
  focus: Vector3;
  departTurn: number;
  length: number;
  duration: number;
  elapsed: number;
}

/** Per-flight state `flightRotation` carries from frame to frame */
export interface FlightView {
  started: boolean;
  /** Direction of travel, smoothed so tight bends never whip the view */
  ahead: Vector3;
  /** About-turns: the starting view and the station's bearing (unwrapped yaw, eased) */
  fromYaw: number;
  fromPitch: number;
  bearingYaw: number;
  bearingPitch: number;
}

export const createFlightView = (): FlightView => ({
  started: false,
  ahead: new Vector3(),
  fromYaw: 0,
  fromPitch: 0,
  bearingYaw: 0,
  bearingPitch: 0,
});

/** Zero velocity and acceleration at both ends */
export const smootherstep = (x: number) => {
  const t = MathUtils.clamp(x, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Shortest signed angle from `a` to `b` */
const wrap = (angle: number) => MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;

/**
 * About-turns' speed profile: rises over the first `accel` of the flight,
 * cruises, and brakes from `brake` with a long slow tail. Both ramps are
 * smooth at both ends; returns the share of the path covered.
 */
function aboutEase(s: number, accel: number, brake: number) {
  const t = MathUtils.clamp(s, 0, 1);
  const area = 0.4 * accel + (brake - accel) + 0.4 * (1 - brake);
  let covered: number;
  if (t < accel) {
    const x = t / accel;
    covered = accel * x ** 4 * (1 - 0.6 * x);
  } else if (t < brake) {
    covered = 0.4 * accel + (t - accel);
  } else {
    const x = (t - brake) / (1 - brake);
    covered =
      0.4 * accel + (brake - accel) + (1 - brake) * x * (1 - 2 * x * x + 2 * x ** 3 - 0.6 * x ** 4);
  }
  return Math.min(covered / area, 1);
}

/**
 * When to brake so that `roundReach` of the path is left as the arc starts
 * rounding the station. Braking earlier leaves less, slower path for the end.
 */
function planBrake(length: number, accel: number, roundFrom: number) {
  const left = Math.min(roundReach, length * 0.3) / length;
  let early = accel;
  let late = 0.95;
  for (let i = 0; i < 24; i++) {
    const brake = (early + late) / 2;
    if (1 - aboutEase(roundFrom, accel, brake) > left) late = brake;
    else early = brake;
  }
  return (early + late) / 2;
}

/** Share of the path covered `s` (0..1) of the way through the flight */
export function flightEase(f: Flight, s: number) {
  return f.about ? aboutEase(s, f.accel, f.brake) : smootherstep(s);
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

/** Which way (+1 left, -1 right, by yaw) turns the heading `from` towards `to` */
const turnSign = (from: Vector3, to: Vector3) =>
  Math.sign(scratch.crossVectors(from, to).dot(up)) || 1;

function planAbout(fromPos: Vector3, fromLook: Vector3, toPos: Vector3, toLook: Vector3) {
  const distance = fromPos.distanceTo(toPos);
  const toward = new Vector3().subVectors(toPos, fromPos).normalize();
  const arrival = new Vector3().subVectors(toPos, toLook);
  arrival.y = 0;
  arrival.normalize();
  const across = new Vector3().crossVectors(up, arrival).normalize();
  // Bow out to the side the camera is coming from (else the side the pose
  // is framed from), so the arc never has to cross the station's front
  const lateral = new Vector3().subVectors(fromPos, toLook).dot(across);
  const framed = new Vector3().subVectors(toPos, toLook).dot(across);
  const side = across.multiplyScalar(
    Math.abs(lateral) > 4 ? Math.sign(lateral) : Math.sign(framed) || -1
  );
  // Rounding the station the view turns towards it, so it first turns the other way
  const departTurn = -turnSign(arrival, side.clone().negate());
  let bow = MathUtils.clamp(distance * 0.14, 12, 30);
  let lift = MathUtils.clamp(distance * 0.05, 0, 12);

  // One cubic arc: away from the start bowing out to the side, and in level
  // with the pose from out to that side, so it curls round onto the front
  const build = () => {
    const curve = new CubicBezierCurve3(
      fromPos.clone(),
      fromPos
        .clone()
        .addScaledVector(toward, distance * 0.38)
        .addScaledVector(side, bow)
        .addScaledVector(up, lift),
      toPos
        .clone()
        .addScaledVector(side, curlOut)
        .addScaledVector(up, lift * 0.3),
      toPos.clone()
    );
    curve.arcLengthDivisions = 400;
    return curve;
  };
  let curve = build();
  for (let i = 0; i < 6 && clearance(curve, fromLook, toLook) < 0; i++) {
    bow += 4;
    lift += 6;
    curve = build();
  }
  return { curve, departTurn };
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
    accel: 0,
    brake: 1,
    departEnd: 0,
    roundFrom: 1,
    focus: toLook.clone(),
    departTurn: 1,
    length: 0,
    duration: 0,
    elapsed: 0,
  };
  if (about) {
    const plan = planAbout(fromPos, fromLook, toPos, toLook);
    f.curve = plan.curve;
    f.departTurn = plan.departTurn;
    f.length = f.curve.getLength();
    f.duration = MathUtils.clamp(3.4 + f.length / 60, 5.2, 7.8);
    f.departEnd = Math.min(departTime / f.duration, 0.5);
    f.roundFrom = Math.max(1 - roundTime / f.duration, 0.42);
    f.accel = f.departEnd * 0.9;
    f.brake = planBrake(f.length, f.accel, f.roundFrom);
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

/** Unwrapped yaw and clamped pitch of a direction, picking the turn nearest `near` */
function heading(direction: Vector3, near: number) {
  const yaw = Math.atan2(-direction.x, -direction.z);
  const flat = Math.hypot(direction.x, direction.z);
  return {
    yaw: near + wrap(yaw - near),
    pitch: MathUtils.clamp(Math.atan2(direction.y, flat), -maxPitch, maxPitch),
  };
}

/**
 * The camera's rotation `s` (0..1) of the way through a flight.
 * Ahead: the start view blended into `rotationTo`, leaning into the
 * direction of travel mid-flight when that is roughly ahead, or dipping the
 * nose a touch when the camera is drifting back.
 * About-turn: the start view turns to face the station (the way
 * `departTurn` says when it is a half turn or so either way), then follows
 * its bearing (eased, unwrapped frame to frame) as the arc rounds it, and
 * settles into `rotationTo`, which looks at the same station.
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
    scratch.subVectors(f.focus, position);
    if (!view.started) {
      view.started = true;
      const from = yawPitch(f.rotationFrom);
      view.fromYaw = from.yaw;
      view.fromPitch = from.pitch;
      const start = heading(scratch, from.yaw);
      let away = start.yaw - from.yaw;
      // Near enough a half turn either way: turn the planned way
      if (Math.abs(away) > 2.6 && Math.sign(away) !== f.departTurn) {
        away -= Math.sign(away) * Math.PI * 2;
      }
      view.bearingYaw = from.yaw + away;
      view.bearingPitch = start.pitch;
    } else if (scratch.lengthSq() > 1) {
      const next = heading(scratch, view.bearingYaw);
      const follow = 1 - Math.exp(-bearingFollow * dt);
      view.bearingYaw += (next.yaw - view.bearingYaw) * follow;
      view.bearingPitch += (next.pitch - view.bearingPitch) * follow;
    }

    const end = yawPitch(rotationTo);
    const endYaw = view.bearingYaw + wrap(end.yaw - view.bearingYaw);
    const away = smootherstep(s / f.departEnd);
    const settle = smootherstep((s - 0.86) / 0.14);
    const yaw = MathUtils.lerp(MathUtils.lerp(view.fromYaw, view.bearingYaw, away), endYaw, settle);
    const pitch = MathUtils.lerp(
      MathUtils.lerp(view.fromPitch, view.bearingPitch, away),
      end.pitch,
      settle
    );
    out.setFromEuler(euler.set(pitch, yaw, 0, 'YXZ'));
    return out.slerp(rotationTo, smootherstep((s - 0.97) / 0.03));
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
