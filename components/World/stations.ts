import { MathUtils, Vector3 } from 'three';

import type { StationKey } from './routes';
import { worldStore } from './worldStore';

export { stationForPath, stationKeys, stationModels, stationPositions } from './routes';
export type { StationKey } from './routes';

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
 * The projects page runs through its projects as a fractional index; this
 * settles it on each one: the middle 60% of the way from one screen to the
 * next carries the move, the rest holds still on the nearer screen
 */
export function settleFocus(focus: number) {
  const whole = Math.floor(focus);
  const x = MathUtils.clamp((focus - whole - 0.2) / 0.6, 0, 1);
  return whole + x * x * x * (x * (x * 6 - 15) + 10);
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

const right = new Vector3();
const up = new Vector3(0, 1, 0);
const forward = new Vector3();
const overviewEye = new Vector3();
const overviewLook = new Vector3();

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

  // `look` is the framed point; `pos` starts as the eye's offset from it.
  // Scroll-follow speeds scale with the zoom so the station still leaves the
  // screen at the same pace; stations the camera travels through do not.
  switch (key) {
    case 'home':
      look.set(0, -screens * 4.2 * zoom, 0);
      pos.set(0, eyeY, distance + screens * 1.8);
      break;
    case 'about':
      look.set(0, -screens * 5.2 * zoom, 0);
      pos.set(0, eyeY, distance);
      break;
    case 'experience':
      look.set(0, -progress * experienceDepth, 0);
      pos.set(0, eyeY, distance);
      break;
    case 'projects': {
      // Ride the helix: the camera orbits down the spiral to face the project
      // the page has scrolled to (worldStore.projectFocus), screen centred.
      // A project page sits the screen beside its copy instead, further back
      const focus = settleFocus(MathUtils.clamp(worldStore.projectFocus, 0, helix.screens - 1));
      const angle = focus * helix.turn;
      const back = worldStore.projectAside ? asideDistance : 1;
      look.set(Math.sin(angle) * helix.radius, helixScreenY(focus), Math.cos(angle) * helix.radius);
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
      const angle = progress * 0.9;
      look.set(0, -screens * 3.2 * zoom, 0);
      pos.set(Math.sin(angle) * distance, eyeY, Math.cos(angle) * distance);
      break;
    }
    case 'contact':
      look.set(0, -screens * 3.4 * zoom, 0);
      pos.set(0, eyeY, distance);
      break;
    default:
      look.set(0, 0, 0);
      pos.set(0, eyeY, distance);
  }
  pos.multiplyScalar(zoom).add(look);

  // Frame the station: object to the right of the copy on wide screens,
  // above the copy on narrow ones. Shift along the camera's own axes.
  forward.subVectors(look, pos).normalize();
  right.crossVectors(forward, up).normalize();
  // The skills constellation is wider than the other stations: give it more
  // room. On the projects page the screen is centred, with its copy around it
  const wide = isWideViewport(width, height);
  const centred = key === 'projects' && !worldStore.projectAside;
  const intro = centred ? projectIntro() : 0;
  const roomy = key === 'skills' ? 4.4 : centred ? overview.room * intro : 3.3;
  const shiftX = wide ? roomy : 0;
  pos.addScaledVector(right, -shiftX).addScaledVector(up, -lift);
  look.addScaledVector(right, -shiftX).addScaledVector(up, -lift);
  // Centred in the space below the header, not the whole viewport
  if (centred && wide) {
    pos.addScaledVector(up, 0.19 * (1 - intro));
    look.addScaledVector(up, 0.19 * (1 - intro));
  }
}
