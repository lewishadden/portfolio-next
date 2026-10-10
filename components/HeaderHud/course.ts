import {
  rangeBetween,
  stationForPath,
  stationKeys,
  stationPositions,
} from 'components/World/routes';
import { worldMode } from 'components/World/worldMode';
import { onFlight, worldStore } from 'components/World/worldStore';
import { motionLevel, subscribeMotion } from '@/utils/motion';

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
/** A flight has set off and not yet arrived, with the world on all the while */
let live = false;

const isStation = (key: string): key is StationKey => stationKeys.includes(key as StationKey);

const smootherstep = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * Starts keeping track (call it when a component that shows the course
 * mounts). The camera is docked at a station once a flight or cut arrives
 * there (or, placed there by a snap below full motion, once motion is back
 * to full), and nowhere once it leaves without arriving: into free roam (a
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
    if (root.dataset.world === 'on') return;
    live = false;
    course.docked = '';
    // A flight cut off with the canvas leaves worldStore.flight active and
    // frozen (nothing ends it): forget its course, so nothing counts it down
    // forever; the next flight's 'start' sets one again
    course.to = '';
  }).observe(root, { attributes: true, attributeFilter: ['data-world'] });
  // Below full motion the camera's first placement is a snap, which
  // announces no arrival: docked stayed '' with the camera at the page's
  // station, and the first flight once motion was back to full counted down
  // from the camera's distance to the destination, not rangeBetween. On the
  // way back to full in page mode, the camera is at the page's station.
  // Not before the canvas is up: its first frame will warp in from deep space
  let level = motionLevel();
  subscribeMotion(() => {
    const was = level;
    level = motionLevel();
    if (was === 'full' || level !== 'full' || course.docked) return;
    if (root.dataset.world !== 'on' || worldMode.get().mode !== 'page') return;
    if (document.querySelector('.world__canvas')) course.docked = stationForPath(location.pathname);
  });
  onFlight((event, to) => {
    if (event === 'start') live = true;
    else if (event === 'end') live = false;
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
 * Whether a camera flight is under way (needs watchCourse). The store's
 * flight.active alone can't tell: a flight cut off with the canvas (3D
 * switched off on the way) stays active and short of its approach, and a
 * new canvas below full motion never writes it again (its first placement
 * is a snap and its moves are cuts), so once 3D was back on at calm or
 * still it read as a flight forever: the palette never focused the new
 * page's heading, and at full the HUD's lock and bottom edge froze. Under
 * way from a flight's 'start' until its 'end' or the world switching off,
 * and only while the store agrees (a flight cut short by free roam ends
 * without an 'end')
 */
export function flightUnderWay() {
  return live && worldStore.flight.active;
}

/**
 * The flight under way: where to and the range still to go in whole km,
 * counting down from the range between the two stations (rangeBetween; for
 * a flight that didn't leave from a station, the distance it set off from)
 * to 0 on arrival, in step with the camera; null when there's no flight
 * (or the world was switched off during it)
 */
export function rangeToGo(): { to: StationKey; km: number } | null {
  const { flight } = worldStore;
  if (!flightUnderWay() || !course.to || course.to !== flight.to) return null;
  const km = Math.round(course.span * (1 - smootherstep(flight.progress)));
  return { to: course.to, km };
}
