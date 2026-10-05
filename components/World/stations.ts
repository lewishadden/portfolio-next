import { Vector3 } from 'three';

import type { StationKey } from './routes';

export { stationForPath, stationKeys, stationModels, stationPositions } from './routes';
export type { StationKey } from './routes';

/** Total fall of the camera through the experience beam (world units) */
export const experienceDepth = 34;

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
  // Terminal and the screen in front of it (the helix wraps around off-screen)
  projects: { height: 0.8, distance: 12.5, halfWidth: 2.6, halfHeight: 1.8, offsetY: -0.1 },
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
      const angle = progress * Math.PI * 0.85;
      look.set(0, -progress * 10, 0);
      pos.set(Math.sin(angle) * distance, eyeY, Math.cos(angle) * distance);
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
  // The skills constellation is wider than the other stations — give it more room
  const shiftX = isWideViewport(width, height) ? (key === 'skills' ? 4.4 : 3.3) : 0;
  pos.addScaledVector(right, -shiftX).addScaledVector(up, -lift);
  look.addScaledVector(right, -shiftX).addScaledVector(up, -lift);
}
