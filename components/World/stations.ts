import { Euler, MathUtils, Vector3 } from 'three';

import { motionLevel } from '@/utils/motion';

import type { StationKey } from './routes';
import { settleFocus } from './ride';
import { orbitTilts } from './skillsOrbit';
import { worldStore } from './worldStore';

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

/**
 * Wide layouts frame every station as designed. Narrow ones pull the camera
 * back until the station fits the screen width and the stage slot, then drop
 * it so the station sits in that slot instead of spilling off the edges.
 */
export function stationFraming(
  key: StationKey,
  width: number,
  height: number,
  out: Framing = { zoom: 1, lift: 0 }
) {
  if (isWideViewport(width, height)) {
    out.zoom = 1;
    out.lift = 0;
    return out;
  }
  const shot = shots[key];
  const slot = slotHeight(height);
  const aspect = width / Math.max(height, 1);
  const distance = Math.max(
    shot.distance,
    shot.halfWidth / (narrowFill * tanHalfFov * aspect),
    shot.halfHeight / ((slot / height) * tanHalfFov)
  );
  // Slot centre in normalised device coordinates (1 = top of the screen)
  const slotCentre = 1 - (2 * (slotTop + slot / 2)) / height;
  out.zoom = distance / shot.distance;
  out.lift = slotCentre * distance * tanHalfFov - shot.offsetY;
  return out;
}

const framing: Framing = { zoom: 1, lift: 0 };

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

/** How far the page has moved the camera into each companion pose, 0..1 */
function companionWeights(count: number, out: number[]) {
  const focus = worldStore.sectionCount > 0 ? worldStore.sectionFocus : -1;
  for (let i = 0; i < count; i++)
    out[i] = MathUtils.smoothstep(focus, i === 0 ? -0.7 : i - 0.3, i === 0 ? 0.2 : i + 0.3);
  return out;
}
const weights: number[] = [];

/** NDC kept between the widest glass panel at the reading line and the station's framing box */
const clearMargin = 0.06;
/** Furthest right (NDC) the station's centre is pushed to clear the glass: it stays in shot */
const clearMost = 0.62;
const subject = new Vector3();

/**
 * How far right (world units, along the camera's right axis) a wide layout
 * has to move the station for its framing box to clear the widest glass
 * panel at the reading line (worldStore.clearRight), from the eye `pos`
 * before any shift, along the pose's axes (`forward` and `right`, set just
 * before); 0 when there is none. Stations the camera travels
 * through (the experience beam, the projects helix) clear the point it
 * frames, the rest their centre.
 */
function clearRoom(key: StationKey, pos: Vector3, look: Vector3, aspect: number) {
  if (worldStore.clearRight <= -1) return 0;
  if (key === 'experience' || key === 'projects') subject.copy(look);
  else subject.set(0, 0, 0);
  subject.sub(pos);
  const depth = subject.dot(forward);
  if (depth < 1) return 0;
  const lateral = subject.dot(right);
  // Half the view's width at the station's depth
  const half = depth * tanHalfFov * aspect;
  const wanted = (worldStore.clearRight + clearMargin) * half + shots[key].halfWidth - lateral;
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
 * reading line (worldStore.skillFocus): the hero shot above the first
 * category, then each category's pose, moving to the next over the first
 * 30% of it. Below full motion it cuts from pose to pose instead.
 */
function skillsEye(distance: number, eyeY: number, out: Vector3) {
  const focus = worldStore.skillFocus;
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
 */
export function stationCamera(
  key: StationKey,
  progress: number,
  screens: number,
  width: number,
  height: number,
  pos: Vector3,
  look: Vector3
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
      const reading = worldStore.roleFocus > -0.99 && worldStore.roleCount > 0;
      const depth = reading
        ? MathUtils.clamp((worldStore.roleFocus + 0.6) / worldStore.roleCount, 0, 1)
        : progress;
      look.set(0, -depth * experienceDepth, 0);
      pos.set(0, eyeY, distance);
      break;
    }
    case 'projects': {
      // Ride the helix: the camera orbits down the spiral to face the project
      // the page has scrolled to (worldStore.projectFocus), screen centred.
      // A project page sits the screen beside its copy instead, further back
      const focus = settleFocus(MathUtils.clamp(worldStore.projectFocus, 0, helix.screens - 1));
      const angle = focus * helix.turn;
      const back = worldStore.projectAside ? asideDistance : 1;
      // Past the last project it descends with the page, a viewport height
      // of drop per viewport height scrolled at the screen's distance, so the
      // last screen scrolls away with its copy rather than under the footer
      const drop = worldStore.projectAside
        ? 0
        : worldStore.projectTail * 2 * distance * zoom * tanHalfFov;
      look.set(
        Math.sin(angle) * helix.radius,
        helixScreenY(focus) - drop,
        Math.cos(angle) * helix.radius
      );
      pos.set(Math.sin(angle) * distance * back, eyeY, Math.cos(angle) * distance * back);
      // At the top of the page it holds back on the whole yard, and comes in
      // to the first screen as the page scrolls to it
      const intro = projectIntro();
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
        skillsEye(distance, eyeY, pos);
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
    companionWeights(poses.length, weights);
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
  const centred = key === 'projects' && !worldStore.projectAside;
  const intro = centred ? projectIntro() : 0;
  const roomy = (key === 'skills' ? 4.4 : centred ? overview.room * intro : 3.3) + room;
  // Further, if that leaves the station behind the widest glass panel at the
  // reading line (worldStore.clearRight)
  const shiftX = wide
    ? Math.max(roomy, centred ? 0 : clearRoom(key, pos, look, width / height))
    : 0;
  pos.addScaledVector(right, -shiftX).addScaledVector(up, -lift);
  look.addScaledVector(right, -shiftX).addScaledVector(up, -lift);
  // Centred in the space below the header, not the whole viewport
  if (centred && wide) {
    pos.addScaledVector(up, 0.19 * (1 - intro));
    look.addScaledVector(up, 0.19 * (1 - intro));
  }
}
