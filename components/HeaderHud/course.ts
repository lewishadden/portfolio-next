import { rangeBetween, stationKeys, stationPositions } from 'components/World/routes';
import { worldMode } from 'components/World/worldMode';
import { onFlight, worldStore } from 'components/World/worldStore';

import type { StationKey } from 'components/World/routes';

/* ------------------------------------------------------------------
   The flight in progress as page chrome tells it (the header HUD's
   label riding its lock, the station readout): from which station, to
   which, and the range still to go. DOM-safe: no three.js, and nothing
   runs until the first call.
   ------------------------------------------------------------------ */

const course: {
  /**
   * The station the camera is docked at: '' until a flight or cut arrives
   * somewhere, and again once it leaves without arriving
   */
  docked: StationKey | '';
  from: StationKey | '';
  to: StationKey | '';
  /** The whole flight's range (km) */
  span: number;
} = { docked: '', from: '', to: '', span: 0 };
let watching = false;

const isStation = (key: string): key is StationKey => stationKeys.includes(key as StationKey);

const smootherstep = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * Starts keeping track (call it when a component that shows the course
 * mounts). The camera is docked at a station once a flight or cut arrives
 * there, and nowhere once it leaves without arriving: into free roam (a
 * flight cut short by it announces no arrival), or with the world switched
 * off (pages visited meanwhile announce nothing, and switching it back on
 * warps in from deep space)
 */
export function watchCourse() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  worldMode.subscribe(() => {
    if (worldMode.get().mode === 'explore') course.docked = '';
  });
  const root = document.documentElement;
  new MutationObserver(() => {
    if (root.dataset.world !== 'on') course.docked = '';
  }).observe(root, { attributes: true, attributeFilter: ['data-world'] });
  onFlight((event, to) => {
    if (!isStation(to)) return;
    if (event === 'start') {
      // From the station docked at; turning round mid-flight, still the one
      // it left (nothing has arrived since)
      course.from = course.docked;
      course.to = to;
      if (course.from && course.from !== to) {
        course.span = rangeBetween(course.from, to);
        return;
      }
      // Not from a station (the warp in, back from free roam, a turn back
      // to where it left): from where the flight sets off. Its path, just
      // planned, starts at the camera; worldStore.camera isn't recorded yet
      // on the first frame of a warp in
      const { path } = worldStore.flight;
      const { camera } = worldStore;
      const [x, y, z] = path.length >= 3 ? path : [camera.x, camera.y, camera.z];
      const [sx, sy, sz] = stationPositions[to];
      course.span = Math.round(Math.hypot(x - sx, y - sy, z - sz));
    } else if (event === 'end') {
      course.docked = to;
    }
  });
}

/**
 * The flight under way: where to and the range still to go in whole km,
 * counting down from the range between the two stations (rangeBetween; for
 * a flight that didn't leave from a station, the distance it set off from)
 * to 0 on arrival, in step with the camera; null when there's no flight
 */
export function rangeToGo(): { to: StationKey; km: number } | null {
  const { flight } = worldStore;
  if (!flight.active || !course.to || course.to !== flight.to) return null;
  const km = Math.round(course.span * (1 - smootherstep(flight.progress)));
  return { to: course.to, km };
}
