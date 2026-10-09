import {
  rangeBetween,
  stationForPath,
  stationKeys,
  stationPositions,
} from 'components/World/routes';
import { onFlight, worldStore } from 'components/World/worldStore';

import type { StationKey } from 'components/World/routes';

/* ------------------------------------------------------------------
   The flight in progress as page chrome tells it (the header HUD's
   label riding its lock, the station readout): from which station, to
   which, and the range still to go. DOM-safe: no three.js, and nothing
   runs until the first call.
   ------------------------------------------------------------------ */

const course: {
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
 * mounts): the station docked at is the page's to begin with, then each
 * arrival's, as flights and cuts announce them
 */
export function watchCourse() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  course.docked = stationForPath(window.location.pathname);
  onFlight((event, to) => {
    if (!isStation(to)) return;
    if (event === 'start') {
      // Turning round mid-flight still counts from where it left
      if (course.to !== to || !worldStore.flight.active) course.from = course.docked;
      course.to = to;
      // Station to station; or, flying in to where it already is (the warp
      // in under the lifting loading screen), from where the camera starts
      const { x, y, z } = worldStore.camera;
      const [sx, sy, sz] = stationPositions[to];
      course.span =
        course.from && course.from !== to
          ? rangeBetween(course.from, to)
          : Math.round(Math.hypot(x - sx, y - sy, z - sz));
    } else if (event === 'end') {
      course.docked = to;
    }
  });
}

/**
 * The flight under way: where to and the range still to go in whole km,
 * counting down from the range between the two stations (rangeBetween; for
 * the warp in, the camera's distance as it set off) to 0 on arrival, in
 * step with the camera; null when there's no flight
 */
export function rangeToGo(): { to: StationKey; km: number } | null {
  const { flight } = worldStore;
  if (!flight.active || !course.to || course.to !== flight.to) return null;
  const km = Math.round(course.span * (1 - smootherstep(flight.progress)));
  return { to: course.to, km };
}
