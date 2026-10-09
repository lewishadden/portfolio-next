import { Euler, MathUtils, Vector3 } from 'three';

import { motionLevel } from '@/utils/motion';

import type { StationKey } from './routes';
import { settleFocus } from './ride';
import { orbitTilts } from './skillsOrbit';
import { emitCue, worldStore } from './worldStore';

export { stationForPath, stationKeys, stationModels, stationPositions } from './routes';
export type { StationKey } from './routes';
export { settleFocus } from './ride';

/** Height of each station's beacon (and the HUD's waypoint for it) above its centre */
const beaconHeights: Partial<Record<StationKey, number>> = { experience: 6, skills: 5 };
export const beaconHeight = (key: StationKey) => beaconHeights[key] ?? 3.6;

/** Total fall of the camera through the experience beam (world units) */
export const experienceDepth = 34;

/** The projects helix: screens on a spiral down the station's spine */
export const helix = { radius: 5.4, turn: 0.78, rise: 1.05, top: 2.4, screens: 15 } as const;
export const helixScreenY = (i: number) => helix.top - i * helix.rise;
/** A project page sits the screen beside its copy, this much further back than the ride */
const asideDistance = 2.2;
/**
 * Before the ride: the camera holds back on the whole yard (eye height and
 * distance, the framed point's height, and how far right of the page head
 * it sits on wide layouts)
 */
const overview = { height: 1.6, distance: 16, lookY: -0.8, room: 4.6 };

/**
 * How far the projects camera is from its ride down the helix: 1 holds it
 * back on the whole yard. Off the projects page (touring past, or flying in
 * before the page has mounted) it holds back too; a project page never does.
 */
export function projectIntro() {
  if (worldStore.projectAside) return 0;
  if (worldStore.projectFocus < 0) return 1;
  return MathUtils.smoothstep(worldStore.projectIntro, 0, 1);
}

/**
 * The projects focus the camera is riding (CameraRig moves it along the
 * helix towards the page's with stepRide, so a jump of a screen or more
 * orbits the spiral instead of cutting a chord across it), -1 while it has
 * none, and the camera's angle round the helix there
 */
let ridden = -1;
let riddenAngle = 0;

/** CameraRig hands over where it is on the ride each frame (-1 off it) */
export function rideProjectFocus(focus: number, angle = focus * helix.turn) {
  ridden = focus;
  riddenAngle = angle;
}

/** Where the page has the projects ride: settled on each screen, 0 off the page */
export const pageProjectFocus = () =>
  settleFocus(MathUtils.clamp(worldStore.projectFocus, 0, helix.screens - 1));

/**
 * The ridden projects focus (CameraRig keeps one and steps it each frame).
 * It passes the page's straight through while that moves a little at a
 * time (the scroll runway), and hops when it jumps (prev / next on a project
 * page, a modal opening another project, the index, End on the runway).
 * A hop moves two things together: the focus (which screen's height the
 * camera is at) and the camera's angle round the helix, which takes the
 * short way round, so even a hop the length of the helix turns the view
 * half a turn at most.
 */
export interface Ride {
  /** Focus ridden (fractional project index); -1 when there is nothing to ride (off the projects pages) */
  value: number;
  /** The camera's angle round the helix (radians), `value` × helix.turn give or take whole turns */
  angle: number;
  hopping: boolean;
  start: number;
  duration: number;
  /** Where the hop set off from, focus and angle: its length sets how long it takes */
  origin: number;
  angleOrigin: number;
  /**
   * Each of the hop's channels runs from → to, setting off at `speed` (focus
   * per second) or `spin` (radians per second): a hop that changes course
   * carries on at the speed it had (0 from rest)
   */
  from: number;
  to: number;
  speed: number;
  angleFrom: number;
  angleTo: number;
  spin: number;
  /** The ride crosses a screen or more: it sounded as it set off, and locks on as it lands */
  long: boolean;
}

export const createRide = (): Ride => ({
  value: -1,
  angle: 0,
  hopping: false,
  start: 0,
  duration: 0,
  origin: 0,
  angleOrigin: 0,
  from: 0,
  to: 0,
  speed: 0,
  angleFrom: 0,
  angleTo: 0,
  spin: 0,
  long: false,
});

/**
 * Jumps smaller than this in a 60th of a second pass straight through, so
 * the runway is as responsive as ever. Scaled to the frame's length: per
 * frame alone, at 120Hz a glide across three screens never hopped, and the
 * camera chased it through the helix
 */
const rideJump = 0.5;
/**
 * Fastest a hop turns the view round the helix (radians per second, at the
 * peak of its ease); flights peak a little under it. Hops were timed by
 * their length alone, so the length of the helix spun the view 1.7 times
 * round at up to 700° a second
 */
const rideTurnRate = 2.4;

/** Shortest signed angle (radians) */
const wrapAngle = (angle: number) =>
  MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;

/** smootherstep: 0 to 1, setting off and arriving at rest */
const ease = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const easeRate = (u: number) => 30 * u * u * (1 - u) * (1 - u);
/** Sets off at unit speed and comes back to rest where it started: carries a speed into a hop */
const carry = (u: number) => u * (1 - u) ** 3 * (1 + 3 * u);
const carryRate = (u: number) => (1 - u) ** 2 * (1 + 2 * u - 15 * u * u);

/** How long a hop of `span` screens turning `turn` radians takes (s): smootherstep peaks at 1.875 times its mean speed */
const hopDuration = (span: number, turn: number) =>
  Math.max(MathUtils.clamp(0.8 + 0.12 * span, 0.8, 2.2), (1.875 * Math.abs(turn)) / rideTurnRate);

/** Where the hop under way has the ride at `u` (0..1 through it) */
function hopAt(ride: Ride, u: number) {
  const d = ride.duration;
  ride.value = MathUtils.clamp(
    ride.from + (ride.to - ride.from) * ease(u) + ride.speed * d * carry(u),
    0,
    helix.screens - 1
  );
  ride.angle =
    ride.angleFrom + (ride.angleTo - ride.angleFrom) * ease(u) + ride.spin * d * carry(u);
}

/** A hop from where the ride is to `goal`, setting off at `speed` / `spin` */
function setOff(ride: Ride, goal: number, t: number, speed: number, spin: number) {
  ride.hopping = true;
  ride.start = t;
  ride.origin = ride.from = ride.value;
  ride.angleOrigin = ride.angleFrom = ride.angle;
  ride.to = goal;
  ride.angleTo = ride.angle + wrapAngle(goal * helix.turn - ride.angle);
  ride.speed = speed;
  ride.spin = spin;
  ride.duration = hopDuration(Math.abs(goal - ride.value), ride.angleTo - ride.angle);
}

/**
 * The page's focus moved mid-hop. While the hop is still setting off, a
 * goal that races on (the page gliding there: the index, a screen click)
 * or drifts re-aims the same hop, re-based so it carries on from where it
 * is: restarted from rest every frame of the glide, it barely moved until
 * the page stopped, and sounded on every frame. Later, a drift is
 * followed; a new jump (back the other way, or on again as it slows) sets
 * off afresh from where it has got to, at the speed it had. Either way it
 * is one ride for the ear
 */
function retarget(ride: Ride, goal: number, t: number, jump: number) {
  const u = (t - ride.start) / ride.duration;
  const drift = Math.abs(goal - ride.to) < jump;
  const onward = Math.sign(goal - ride.to) === Math.sign(ride.to - ride.origin);
  if (u < 0.5 && (drift || onward)) {
    const angleTo = ride.angle + wrapAngle(goal * helix.turn - ride.angle);
    ride.duration = Math.max(
      ride.duration,
      hopDuration(Math.abs(goal - ride.origin), angleTo - ride.angleOrigin)
    );
    const at = (t - ride.start) / ride.duration;
    const eased = ease(at);
    const carried = carry(at) * ride.duration;
    ride.from = (ride.value - goal * eased - ride.speed * carried) / (1 - eased);
    ride.angleFrom = (ride.angle - angleTo * eased - ride.spin * carried) / (1 - eased);
    ride.to = goal;
    ride.angleTo = angleTo;
  } else if (drift) {
    ride.angleTo += (goal - ride.to) * helix.turn;
    ride.to = goal;
  } else {
    const d = ride.duration;
    const speed = ((ride.to - ride.from) * easeRate(u)) / d + ride.speed * carryRate(u);
    const spin = ((ride.angleTo - ride.angleFrom) * easeRate(u)) / d + ride.spin * carryRate(u);
    setOff(ride, goal, t, speed, spin);
  }
  if (!ride.long && Math.abs(goal - ride.origin) >= 1) {
    ride.long = true;
    emitCue('select');
  }
}

/**
 * Moves the ride towards `goal` (the page's focus, -1 off the projects
 * pages) at clock time `t`, `dt` after the last frame: straight through
 * while it moves less than `rideJump` at a time, else a hop of 0.8 to 2.2s
 * depending on its length (longer if it would turn the view faster than
 * `rideTurnRate`). A ride over a screen or more sounds once as it sets off
 * ('select') and once as it lands ('hud-lock'). Cuts when the camera does
 * (`snap`)
 */
export function stepRide(ride: Ride, goal: number, t: number, dt: number, snap: boolean) {
  if (snap || goal < 0 || ride.value < 0) {
    ride.value = goal;
    ride.angle = goal * helix.turn;
    ride.hopping = false;
    return;
  }
  if (ride.hopping) {
    const u = (t - ride.start) / ride.duration;
    if (u < 1) hopAt(ride, u);
    else {
      ride.value = ride.to;
      ride.angle = ride.angleTo;
      ride.hopping = false;
      if (ride.long) emitCue('hud-lock');
    }
  }
  const jump = rideJump * Math.min(1, dt * 60);
  if (ride.hopping) {
    if (goal !== ride.to) {
      retarget(ride, goal, t, jump);
      hopAt(ride, (t - ride.start) / ride.duration);
    }
  } else if (Math.abs(goal - ride.value) < jump) {
    ride.value = goal;
    ride.angle = goal * helix.turn;
  } else {
    setOff(ride, goal, t, 0, 0);
    ride.long = Math.abs(goal - ride.origin) >= 1;
    if (ride.long) emitCue('select');
  }
}

/**
 * The project the camera is in front of on the ride (fractional): the
 * ridden focus, or the page's when the rig isn't riding. The station's
 * front screen should follow this rather than the page, so it lights as
 * the camera arrives
 */
export const riddenProjectFocus = () => (ridden >= 0 ? ridden : pageProjectFocus());

/** Wide layouts push the station's hero object to the right of the copy */
export const isWideViewport = (width: number, height: number) =>
  width >= 900 && width / height > 1.1;

/** Vertical field of view of the settled camera, in degrees (flights widen it) */
export const baseFov = 42;
const tanHalfFov = Math.tan((baseFov * Math.PI) / 360);

/**
 * How the camera shoots each station: the eye's height and distance from the
 * framed point, and the box that has to stay in shot on narrow layouts
 * (half-width, half-height and its centre's height above the framed point).
 */
interface Shot {
  height: number;
  distance: number;
  halfWidth: number;
  halfHeight: number;
  offsetY: number;
}

const shots: Record<StationKey, Shot> = {
  // Astronaut inside the portal ring
  home: { height: 0.2, distance: 11, halfWidth: 2.6, halfHeight: 2.3, offsetY: 0 },
  // Helmet and its data rings
  about: { height: 0.3, distance: 11, halfWidth: 3, halfHeight: 1.7, offsetY: 0.3 },
  // The satellite's orbit around the beam
  experience: { height: 0.6, distance: 12, halfWidth: 3.1, halfHeight: 1.4, offsetY: 0 },
  // The project screen in front of the camera, centred and close
  projects: { height: 0.15, distance: 4.3, halfWidth: 1.45, halfHeight: 0.9, offsetY: 0 },
  // Planet and its ring (the skill orbits wrap around off-screen)
  skills: { height: 0.4, distance: 12.5, halfWidth: 3.9, halfHeight: 2.1, offsetY: 0 },
  // Globe with the rocket parked above its right shoulder
  contact: { height: 0.4, distance: 12.5, halfWidth: 2.35, halfHeight: 2.65, offsetY: 0.75 },
  lost: { height: 0, distance: 10, halfWidth: 2.2, halfHeight: 1.9, offsetY: 0 },
};

/**
 * Narrow layouts stack the copy under a stage slot (.hero__stage /
 * .page-head__stage): it starts just under the header and is about a third
 * of the screen tall. Keep these in step with those rules.
 */
const slotTop = 84;
const slotHeight = (height: number) => Math.min(Math.max(height * 0.32, 176), 320);
/** Share of the screen width a station may fill on narrow layouts */
const narrowFill = 0.92;

export interface Framing {
  /** How far the camera pulls back from the station's usual distance */
  zoom: number;
  /** How far the camera drops so the station rises into the stage slot */
  lift: number;
}

/** A stretch of the screen to frame the station in, CSS px from the top */
export interface Slot {
  top: number;
  height: number;
}

/**
 * Wide layouts frame every station as designed. Narrow ones pull the camera
 * back until the station fits the screen width and the stage slot (or the
 * `slot` given: a world window further down the page), then drop it so the
 * station sits in that slot instead of spilling off the edges.
 */
export function stationFraming(
  key: StationKey,
  width: number,
  height: number,
  out: Framing = { zoom: 1, lift: 0 },
  slot?: Slot
) {
  if (isWideViewport(width, height)) {
    out.zoom = 1;
    out.lift = 0;
    return out;
  }
  const shot = shots[key];
  const top = slot ? slot.top : slotTop;
  const tall = slot ? slot.height : slotHeight(height);
  const aspect = width / Math.max(height, 1);
  const distance = Math.max(
    shot.distance,
    shot.halfWidth / (narrowFill * tanHalfFov * aspect),
    shot.halfHeight / ((tall / height) * tanHalfFov)
  );
  // Slot centre in normalised device coordinates (1 = top of the screen)
  const slotCentre = 1 - (2 * (top + tall / 2)) / height;
  out.zoom = distance / shot.distance;
  out.lift = slotCentre * distance * tanHalfFov - shot.offsetY;
  return out;
}

const framing: Framing = { zoom: 1, lift: 0 };
const windowFraming: Framing = { zoom: 1, lift: 0 };
const windowEye = new Vector3();
const windowLook = new Vector3();

/**
 * Phones: the page leaves "windows" in its copy ([data-world-window],
 * worldStore.worldWindow) where the station is framed again mid-page. As
 * one passes the reading line the camera swings round the station by this
 * much (radians), gently, and frames it inside the window instead of
 * leaving it scrolled away above the copy
 */
const windowSwing = 0.35;
/** How close to the reading line (share of the screen's height) a window starts and finishes taking the camera */
const windowNear = 0.05;
const windowFar = 0.4;

/**
 * How far the nearest world window has the camera, 0..1, from its distance
 * to the reading line. The station comes back from wherever the page left
 * it, so below full motion it cuts into the window halfway instead of
 * sweeping in with the scroll
 */
function windowWeight(height: number) {
  const view = worldStore.worldWindow;
  if (view.height <= 0) return 0;
  const line = height * 0.45;
  const bottom = view.top + view.height;
  const away = (view.top > line ? view.top - line : bottom < line ? line - bottom : 0) / height;
  if (motionLevel() !== 'full') return away < (windowNear + windowFar) / 2 ? 1 : 0;
  return 1 - MathUtils.smoothstep(away, windowNear, windowFar);
}

/** The pose that frames the station inside the nearest world window (station-local) */
function windowPose(key: StationKey, width: number, height: number, pos: Vector3, look: Vector3) {
  const { zoom, lift } = stationFraming(key, width, height, windowFraming, worldStore.worldWindow);
  const { height: eyeY, distance } = shots[key];
  look.set(0, 0, 0);
  pos
    .set(Math.sin(windowSwing) * distance, eyeY, Math.cos(windowSwing) * distance)
    .multiplyScalar(zoom);
  pos.y -= lift;
  look.y -= lift;
}

/**
 * Station-local height of the point the camera frames, given the camera's own
 * station-local height — for objects that follow the camera down a station.
 */
export function framedHeight(key: StationKey, cameraY: number, width: number, height: number) {
  stationFraming(key, width, height, framing);
  return cameraY - shots[key].height * framing.zoom + framing.lift;
}

/** How far the camera is from the project screen in front, riding the helix */
export function frontScreenDistance(width: number, height: number) {
  return shots.projects.distance * stationFraming('projects', width, height, framing).zoom;
}

const right = new Vector3();
const up = new Vector3(0, 1, 0);
const forward = new Vector3();
const overviewEye = new Vector3();
const overviewLook = new Vector3();
const companionEye = new Vector3();
const companionLook = new Vector3();

/**
 * Long pages keep their station in view as they are read (wide layouts:
 * the copy stays in one column and the veil keeps it legible). Past the
 * hero the camera pulls back and swings round the station as each section
 * ([data-world-section], worldStore.sectionFocus) reaches the reading line,
 * so the station stays beside the copy as a backdrop instead of scrolling
 * away. Each pose: the swing round the station (radians), how far back
 * (times the usual distance) and how high the eye is, the framed point,
 * and the extra push to the right. The home page's last pose looks out
 * past the hub along the line of stations its cards lead to.
 */
interface Companion {
  swing: number;
  back: number;
  rise: number;
  look: [number, number, number];
  room: number;
}

// Rooms clear the left-hand column of cards and panels wide layouts keep the
// copy in (at most min(46rem, 58vw) wide, about 0.23 in NDC)
const companions: Partial<Record<StationKey, Companion[]>> = {
  home: [
    { swing: 0.5, back: 2.4, rise: 2.6, look: [0, 0.3, 0], room: 4.4 },
    { swing: 0.13, back: 5.5, rise: 5.8, look: [-6, -2, -46], room: 3.5 },
  ],
  about: [
    // The bio (About.tsx's grid): swung round so the habitat, 15 units behind
    // the helmet, comes out from behind the copy, and further right and up,
    // clear of the bio's column before it reaches the reading line
    { swing: 0.5, back: 2.1, rise: 1.4, look: [0, -0.8, 0], room: 5.2 },
    { swing: 0.5, back: 1.9, rise: 1.6, look: [0, 0.3, 0], room: 3.2 },
  ],
  contact: [{ swing: 0.38, back: 1.8, rise: 1.6, look: [0.8, 0.6, -1], room: 3.9 }],
};

/** How far the section being read (`focus`, -1 for none) moves the camera into each companion pose, 0..1 */
function companionWeights(count: number, focus: number, out: number[]) {
  for (let i = 0; i < count; i++)
    out[i] = MathUtils.smoothstep(focus, i === 0 ? -0.7 : i - 0.3, i === 0 ? 0.2 : i + 0.3);
  return out;
}
const weights: number[] = [];

/** NDC kept between the glass panels at the reading line and the station's framing box */
const clearMargin = 0.06;
/** Furthest right (NDC) the station's centre is pushed to clear the glass: it stays in shot */
const clearMost = 0.62;
const subject = new Vector3();

/**
 * How far right (world units, along the camera's right axis) a wide layout
 * has to move the station for its framing box to clear the glass panels
 * at the reading line (`clear`, worldStore.clearRight), from the eye `pos`
 * before any shift, along the pose's axes (`forward` and `right`, set just
 * before); 0 when there is none. Stations the camera travels
 * through (the experience beam, the projects helix) clear the point it
 * frames, the rest their centre.
 */
function clearRoom(key: StationKey, pos: Vector3, look: Vector3, aspect: number, clear: number) {
  if (clear <= -1) return 0;
  if (key === 'experience' || key === 'projects') subject.copy(look);
  else subject.set(0, 0, 0);
  subject.sub(pos);
  const depth = subject.dot(forward);
  if (depth < 1) return 0;
  const lateral = subject.dot(right);
  // Half the view's width at the station's depth
  const half = depth * tanHalfFov * aspect;
  const wanted = (clear + clearMargin) * half + shots[key].halfWidth - lateral;
  return Math.min(wanted, clearMost * half - lateral);
}

/**
 * /skills on wide layouts: the planet stays in shot (it only sinks this far
 * over the whole page) while the eye moves round it to one pose per
 * category, facing that category's orbit: this far (radians) above its
 * plane, so the orbit opens out into an ellipse, and this much further back
 * than the hero shot. The skills grid is one column there (min(48rem, 58vw)),
 * so the constellation has the right of the screen.
 */
const skillsDescent = 1.6;
const orbitView = 0.42;
const orbitBack = 1.15;
const orbitTilt = new Euler();
const eyeFrom = new Vector3();
const eyeTo = new Vector3();

/** The eye's offset from the planet facing category `k`'s orbit (orbitTilts, as SkillsStation tilts it) */
function orbitEye(k: number, distance: number, out: Vector3) {
  const [x, z] = orbitTilts[k % orbitTilts.length];
  return out
    .set(0, Math.sin(orbitView), Math.cos(orbitView))
    .applyEuler(orbitTilt.set(x, 0, z))
    .multiplyScalar(distance * orbitBack);
}

/**
 * Wide /skills: the eye's offset from the planet for the category at the
 * reading line (`focus`, worldStore.skillFocus): the hero shot above the
 * first category, then each category's pose, moving to the next over the
 * first 30% of it. Below full motion it cuts from pose to pose instead.
 */
function skillsEye(distance: number, eyeY: number, focus: number, out: Vector3) {
  const cut = motionLevel() !== 'full';
  let weight: number;
  if (focus < 0) {
    eyeFrom.set(0, eyeY, distance);
    orbitEye(0, distance, eyeTo);
    weight = cut ? (focus >= -0.3 ? 1 : 0) : MathUtils.smootherstep(focus, -0.6, 0);
  } else {
    const k = Math.floor(focus);
    orbitEye(Math.max(k - 1, 0), distance, eyeFrom);
    orbitEye(k, distance, eyeTo);
    const into = focus - k;
    weight = k === 0 ? 1 : cut ? (into >= 0.15 ? 1 : 0) : MathUtils.smootherstep(into, 0, 0.3);
  }
  // Round the planet rather than through it: blend the direction and the distance apart
  const length = MathUtils.lerp(eyeFrom.length(), eyeTo.length(), weight);
  return out.lerpVectors(eyeFrom, eyeTo, weight).setLength(length);
}

/**
 * Camera pose inside a station, in station-local space.
 * `progress` is page scroll 0..1, `screens` is viewport-heights scrolled,
 * `width` / `height` the canvas size in CSS pixels. Writes into `pos` / `look`.
 * `reading` (the default) frames the page's own station as the page is
 * read: the section, role, skills category and project at the reading line,
 * its glass panels and its world windows. A tour stop, or the route a link
 * previews, passes false and is framed from the top of its page instead:
 * those measure the page on screen, which is hidden while touring and is
 * another station's page for a preview
 */
export function stationCamera(
  key: StationKey,
  progress: number,
  screens: number,
  width: number,
  height: number,
  pos: Vector3,
  look: Vector3,
  reading = true
) {
  const { zoom, lift } = stationFraming(key, width, height, framing);
  const { height: eyeY, distance } = shots[key];
  const wide = isWideViewport(width, height);

  // `look` is the framed point; `pos` starts as the eye's offset from it.
  // Scroll-follow speeds scale with the zoom so the station still leaves the
  // screen at the same pace; stations the camera travels through do not.
  switch (key) {
    case 'home':
      look.set(0, -screens * 4.2 * zoom, 0);
      pos.set(0, eyeY, distance + screens * 1.8);
      break;
    case 'about':
      // At page speed (a viewport height of drop per viewport height
      // scrolled, at the station's distance), so the station leaves with the
      // page head: slower, it hung over the bio as the bio came up under it
      look.set(0, -screens * 2 * distance * tanHalfFov * zoom, 0);
      pos.set(0, eyeY, distance);
      break;
    case 'experience': {
      // Down the beam to the pod of the role being read on the page (each
      // pod sits (i + 0.6) / count of the way down), else with the scroll
      const onRole = reading && worldStore.roleFocus > -0.99 && worldStore.roleCount > 0;
      const depth = onRole
        ? MathUtils.clamp((worldStore.roleFocus + 0.6) / worldStore.roleCount, 0, 1)
        : progress;
      look.set(0, -depth * experienceDepth, 0);
      pos.set(0, eyeY, distance);
      break;
    }
    case 'projects': {
      // Ride the helix: the camera orbits down the spiral to face the project
      // the page has scrolled to (worldStore.projectFocus, as CameraRig rides
      // it), screen centred. A project page sits the screen beside its copy
      // instead, further back
      const focus = riddenProjectFocus();
      const angle = ridden >= 0 ? riddenAngle : focus * helix.turn;
      const aside = reading && worldStore.projectAside;
      const back = aside ? asideDistance : 1;
      // Past the last project it descends with the page, a viewport height
      // of drop per viewport height scrolled at the screen's distance, so the
      // last screen scrolls away with its copy rather than under the footer
      const drop = aside ? 0 : worldStore.projectTail * 2 * distance * zoom * tanHalfFov;
      look.set(
        Math.sin(angle) * helix.radius,
        helixScreenY(focus) - drop,
        Math.cos(angle) * helix.radius
      );
      pos.set(Math.sin(angle) * distance * back, eyeY, Math.cos(angle) * distance * back);
      // At the top of the page it holds back on the whole yard, and comes in
      // to the first screen as the page scrolls to it (off the page, always)
      const intro = reading ? projectIntro() : 1;
      if (intro > 0) {
        look.lerp(overviewLook.set(0, overview.lookY, 0), intro);
        pos.lerp(overviewEye.set(0, overview.height, overview.distance), intro);
      }
      break;
    }
    case 'skills': {
      if (wide) {
        // Beside the one-column grid: the planet stays in shot, the eye
        // turns to face the orbit of the category being read
        look.set(0, -progress * skillsDescent, 0);
        skillsEye(distance, eyeY, reading ? worldStore.skillFocus : -1, pos);
        break;
      }
      const angle = progress * 0.9;
      look.set(0, -screens * 3.2 * zoom, 0);
      pos.set(Math.sin(angle) * distance, eyeY, Math.cos(angle) * distance);
      break;
    }
    case 'contact': {
      // A message sending (and the launch after it) holds the globe in view
      const held = worldStore.transmitting || performance.now() < worldStore.showcaseUntil;
      look.set(0, -(held ? 0 : screens) * 3.4 * zoom, 0);
      pos.set(0, eyeY, distance);
      break;
    }
    default:
      look.set(0, 0, 0);
      pos.set(0, eyeY, distance);
  }

  // Long pages on wide layouts: into the companion poses as they are read
  // (not while the contact page holds the globe for a launch)
  const poses = wide ? companions[key] : undefined;
  const showcase =
    key === 'contact' && (worldStore.transmitting || performance.now() < worldStore.showcaseUntil);
  let room = 0;
  if (poses && !showcase) {
    const section = reading && worldStore.sectionCount > 0 ? worldStore.sectionFocus : -1;
    companionWeights(poses.length, section, weights);
    poses.forEach((pose, i) => {
      const weight = weights[i];
      if (weight <= 0) return;
      companionLook.fromArray(pose.look);
      companionEye.set(
        Math.sin(pose.swing) * distance * pose.back,
        eyeY + pose.rise,
        Math.cos(pose.swing) * distance * pose.back
      );
      look.lerp(companionLook, weight);
      pos.lerp(companionEye, weight);
      room = MathUtils.lerp(room, pose.room, weight);
    });
  }
  pos.multiplyScalar(zoom).add(look);

  // Frame the station: object to the right of the copy on wide screens,
  // above the copy on narrow ones. Shift along the camera's own axes.
  forward.subVectors(look, pos).normalize();
  right.crossVectors(forward, up).normalize();
  // The skills constellation is wider than the other stations: give it more
  // room. On the projects page the screen is centred, with its copy around it
  const centred = key === 'projects' && !(reading && worldStore.projectAside);
  const intro = centred ? (reading ? projectIntro() : 1) : 0;
  const roomy = (key === 'skills' ? 4.4 : centred ? overview.room * intro : 3.3) + room;
  // Further, if that leaves the station behind the glass panels at the
  // reading line (worldStore.clearRight)
  const shiftX = wide
    ? Math.max(
        roomy,
        centred
          ? 0
          : clearRoom(key, pos, look, width / height, reading ? worldStore.clearRight : -1)
      )
    : 0;
  pos.addScaledVector(right, -shiftX).addScaledVector(up, -lift);
  look.addScaledVector(right, -shiftX).addScaledVector(up, -lift);
  // Centred in the space below the header, not the whole viewport
  if (centred && wide) {
    pos.addScaledVector(up, 0.19 * (1 - intro));
    look.addScaledVector(up, 0.19 * (1 - intro));
  }

  // Phones: into the world window passing the reading line, if there is one
  const into = wide || !reading ? 0 : windowWeight(height);
  if (into > 0) {
    windowPose(key, width, height, windowEye, windowLook);
    pos.lerp(windowEye, into);
    look.lerp(windowLook, into);
  }
}
