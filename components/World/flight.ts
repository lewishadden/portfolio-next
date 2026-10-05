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

   About-turn (the destination is behind): the camera turns to face the
   way it is going as it pulls away, cruises there, runs in past the
   station's side and, as it slows, turns back round towards the station
   to settle on its viewing pose: two opposite turns (an S, never a full
   spin) with a straight run between them. The heading it turns to is
   the path a little way ahead, so the view never whips round on a bend.

   Distance along the path eases in and out, so speed rises and falls
   without a jolt at either end; about-turns gather speed slowly while
   they turn, and brake early with a long slow tail so the turn back
   happens beside the station rather than out in open space.
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
/** How far out beside the station an about-turn runs in */
const passRadius = 13;
/** About-turns: seconds spent turning away, and turning back (they overlap on short flights) */
const departTime = 3;
const flipTime = 3;
/** About-turns: path left when the turn back begins, about a pass beside the station */
const flipReach = 34;
/** How far ahead on the path the about-turn's heading looks (world units) */
const headingReach = 22;
/** How quickly (per second) the about-turn's view follows the path's heading */
const headingFollow = 3;
/** Steepest the camera pitches to follow the path */
const maxPitch = 0.3;

export interface Flight {
  curve: Curve<Vector3>;
  /** Where the path ends (the destination pose when the flight was planned) */
  end: Vector3;
  /** The camera's rotation when the flight began */
  rotationFrom: Quaternion;
  about: boolean;
  /** About-turns: when speed stops building, braking begins, the turn away ends and the turn back begins (shares of the flight) */
  accel: number;
  brake: number;
  departEnd: number;
  flipFrom: number;
  /** About-turns: which way (+1 left, -1 right) the camera turns away, and turns back */
  departTurn: number;
  flipTurn: number;
  length: number;
  duration: number;
  elapsed: number;
}

/** Per-flight state `flightRotation` carries from frame to frame */
export interface FlightView {
  started: boolean;
  /** Direction of travel, smoothed so tight bends never whip the view */
  ahead: Vector3;
  /** About-turns: the starting view, the heading it turns to and the final view (unwrapped yaws) */
  fromYaw: number;
  fromPitch: number;
  cruiseYaw: number;
  cruisePitch: number;
  endYaw: number;
  flipping: boolean;
}

export const createFlightView = (): FlightView => ({
  started: false,
  ahead: new Vector3(),
  fromYaw: 0,
  fromPitch: 0,
  cruiseYaw: 0,
  cruisePitch: 0,
  endYaw: 0,
  flipping: false,
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
 * When to brake so that `flipReach` of the path is left as the turn back
 * begins. Braking earlier leaves less, slower path for the end.
 */
function planBrake(length: number, accel: number, flipFrom: number) {
  const left = Math.min(flipReach, length * 0.3) / length;
  let early = accel;
  let late = 0.95;
  for (let i = 0; i < 24; i++) {
    const brake = (early + late) / 2;
    if (1 - aboutEase(flipFrom, accel, brake) > left) late = brake;
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
  // Run in on the side the camera is coming from (else the side the pose
  // is framed from), so the path never has to cross the station's front
  const lateral = new Vector3().subVectors(fromPos, toLook).dot(across);
  const framed = new Vector3().subVectors(toPos, toLook).dot(across);
  const side = across.multiplyScalar(
    Math.abs(lateral) > 4 ? Math.sign(lateral) : Math.sign(framed) || -1
  );
  // Running in past the station the camera faces along `arrival`; it turns
  // back towards the station, and turned away from it the other way
  const flipTurn = turnSign(arrival, side.clone().negate());
  let lift = MathUtils.clamp(distance * 0.05, 0, 12);

  const r = passRadius;
  const build = () => {
    const points = [fromPos.clone()];
    // Climb away towards the destination, when there is room for it
    if (distance > 60) {
      points.push(
        fromPos
          .clone()
          .addScaledVector(toward, Math.min(0.24 * distance, 42))
          .addScaledVector(up, lift)
      );
    }
    // In past the station's side, then round onto its viewing pose
    points.push(
      toLook
        .clone()
        .addScaledVector(side, r)
        .addScaledVector(arrival, -r * 0.45)
        .addScaledVector(up, lift * 0.3),
      toLook
        .clone()
        .addScaledVector(side, r * 0.92)
        .addScaledVector(arrival, r * 0.55)
        .addScaledVector(up, lift * 0.1),
      toPos.clone()
    );
    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    curve.arcLengthDivisions = 400;
    return curve;
  };
  let curve = build();
  for (let i = 0; i < 6 && clearance(curve, fromLook, toLook) < 0; i++) {
    lift += 8;
    curve = build();
  }
  return { curve, flipTurn };
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
    flipFrom: 1,
    departTurn: 1,
    flipTurn: 1,
    length: 0,
    duration: 0,
    elapsed: 0,
  };
  if (about) {
    const plan = planAbout(fromPos, fromLook, toPos, toLook);
    f.curve = plan.curve;
    f.flipTurn = plan.flipTurn;
    f.departTurn = -plan.flipTurn;
    f.length = f.curve.getLength();
    f.duration = MathUtils.clamp(3.4 + f.length / 60, 5.2, 7.8);
    f.departEnd = Math.min(departTime / f.duration, 0.5);
    f.flipFrom = Math.max(1 - flipTime / f.duration, 0.42);
    f.accel = f.departEnd * 0.9;
    f.brake = planBrake(f.length, f.accel, f.flipFrom);
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
 * About-turns: where the camera is heading, the path `headingReach` ahead.
 * Returns false once the path ahead is too short to give a direction.
 */
function aboutHeading(f: Flight, s: number, position: Vector3, out: Vector3) {
  const along = Math.min(flightEase(f, s) + headingReach / f.length, 1);
  out.copy(f.curve.getPointAt(along)).sub(position);
  return out.lengthSq() > 9;
}

/**
 * The camera's rotation `s` (0..1) of the way through a flight.
 * Ahead: the start view blended into `rotationTo`, leaning into the
 * direction of travel mid-flight when that is roughly ahead, or dipping the
 * nose a touch when the camera is drifting back.
 * About-turn: the start view turns to the heading (the way `departTurn`
 * says when it is a half turn or so either way), follows it, then turns
 * back the way `flipTurn` says into `rotationTo`, which faces the station.
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
    if (!view.started) {
      view.started = true;
      const from = yawPitch(f.rotationFrom);
      view.fromYaw = from.yaw;
      view.fromPitch = from.pitch;
      aboutHeading(f, s, position, scratch);
      const start = heading(scratch, from.yaw);
      let away = start.yaw - from.yaw;
      // Near enough a half turn either way: turn the planned way
      if (Math.abs(away) > 2.6 && Math.sign(away) !== f.departTurn) {
        away -= Math.sign(away) * Math.PI * 2;
      }
      view.cruiseYaw = from.yaw + away;
      view.cruisePitch = start.pitch;
      view.flipping = false;
    } else if (s < f.flipFrom && aboutHeading(f, s, position, scratch)) {
      // Eased, so bends in the path never jerk the view, and held through
      // the turn back, so the bend onto the pose adds no swing
      const next = heading(scratch, view.cruiseYaw);
      const follow = 1 - Math.exp(-headingFollow * dt);
      view.cruiseYaw += (next.yaw - view.cruiseYaw) * follow;
      view.cruisePitch += (next.pitch - view.cruisePitch) * follow;
    }

    const end = yawPitch(rotationTo);
    if (!view.flipping && s >= f.flipFrom) {
      view.flipping = true;
      let back = wrap(end.yaw - view.cruiseYaw);
      if (Math.abs(back) > 1.6 && Math.sign(back) !== f.flipTurn) {
        back -= Math.sign(back) * Math.PI * 2;
      }
      view.endYaw = view.cruiseYaw + back;
    } else if (view.flipping) {
      view.endYaw += wrap(end.yaw - view.endYaw);
    }

    const away = smootherstep(s / f.departEnd);
    const back = view.flipping ? smootherstep((s - f.flipFrom) / (1 - f.flipFrom)) : 0;
    let yaw = MathUtils.lerp(view.fromYaw, view.cruiseYaw, away);
    let pitch = MathUtils.lerp(view.fromPitch, view.cruisePitch, away);
    yaw = MathUtils.lerp(yaw, view.endYaw, back);
    pitch = MathUtils.lerp(pitch, end.pitch, back);
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
