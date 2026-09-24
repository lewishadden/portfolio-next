import { Vector3 } from 'three';

import type { Vector3Tuple } from 'three';
import type { StationKey } from './routes';

export { stationForPath, stationKeys } from './routes';
export type { StationKey } from './routes';

/**
 * Where each route lives in space. Stations are spread far enough apart that
 * the camera visibly travels (and passes stars/dust) between them.
 */
export const stationPositions: Record<StationKey, Vector3Tuple> = {
  home: [0, 0, 0],
  about: [48, 12, -36],
  experience: [-42, -4, -82],
  projects: [36, -16, -132],
  skills: [-36, 14, -178],
  contact: [8, -6, -226],
  lost: [96, 44, 34],
};

/** GLB each station loads (optimised with scripts/optimize-models.mjs) */
export const stationModels: Partial<Record<StationKey, string>> = {
  home: '/static/models/astronaut.glb',
  about: '/static/models/helmet.glb',
  experience: '/static/models/satellite.glb',
  projects: '/static/models/terminal.glb',
  contact: '/static/models/rocket.glb',
  lost: '/static/models/astronaut.glb',
};

/** Total fall of the camera through the experience beam (world units) */
export const experienceDepth = 34;

/** Wide layouts push the station's hero object to the right of the copy */
export const isWideViewport = (width: number, height: number) =>
  width >= 900 && width / height > 1.1;

const right = new Vector3();
const up = new Vector3(0, 1, 0);
const forward = new Vector3();

/**
 * Camera pose inside a station, in station-local space.
 * `progress` is page scroll 0..1, `screens` is viewport-heights scrolled.
 * Writes into `pos` / `look`.
 */
export function stationCamera(
  key: StationKey,
  progress: number,
  screens: number,
  wide: boolean,
  pos: Vector3,
  look: Vector3
) {
  switch (key) {
    case 'home':
      pos.set(0, 0.2 - screens * 4.2, 11 + screens * 1.8);
      look.set(0, -screens * 4.2, 0);
      break;
    case 'about':
      pos.set(0, 0.3 - screens * 5.2, 11);
      look.set(0, -screens * 5.2, 0);
      break;
    case 'experience':
      pos.set(0, 0.6 - progress * experienceDepth, 12);
      look.set(0, -progress * experienceDepth, 0);
      break;
    case 'projects': {
      const angle = progress * Math.PI * 0.85;
      pos.set(Math.sin(angle) * 12.5, 0.8 - progress * 10, Math.cos(angle) * 12.5);
      look.set(0, -progress * 10, 0);
      break;
    }
    case 'skills': {
      const angle = progress * 0.9;
      pos.set(Math.sin(angle) * 12.5, 0.4 - screens * 3.2, Math.cos(angle) * 12.5);
      look.set(0, -screens * 3.2, 0);
      break;
    }
    case 'contact':
      pos.set(0, 0.4 - screens * 3.4, 12.5);
      look.set(0, -screens * 3.4, 0);
      break;
    default:
      pos.set(0, 0, 10);
      look.set(0, 0, 0);
  }

  // Frame the station: object to the right of the copy on wide screens,
  // above the copy on narrow ones. Shift along the camera's own axes.
  forward.subVectors(look, pos).normalize();
  right.crossVectors(forward, up).normalize();
  const shiftX = wide ? 3.3 : 0;
  const shiftY = wide ? 0 : -2.5;
  pos.addScaledVector(right, -shiftX).addScaledVector(up, shiftY);
  look.addScaledVector(right, -shiftX).addScaledVector(up, shiftY);
}
