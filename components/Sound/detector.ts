import { detectorRange, nearestAt } from 'components/World/signalStore';
import { worldMode } from 'components/World/worldMode';
import { worldStore } from 'components/World/worldStore';

/* ------------------------------------------------------------------
   Free roam's signal detector, heard and felt: while exploring with an
   unfound signal in detector range (signalStore's nearestAt), it pings
   from where that signal is, more often the closer the ship flies: every
   2.4s at one bar, every 0.35s at five. The sound engine plays the ping
   through a panner of its own; haptics tick with it from four bars. It
   only runs in free roam, and only while something listens. DOM-safe.
   ------------------------------------------------------------------ */

type Point = readonly [number, number, number];
type SonarListener = (at: Point, bars: number) => void;

/** How often the detector checks whether the next ping is due (ms) */
const checkEvery = 100;
/** Seconds between pings at one bar and at five */
const slowest = 2.4;
const fastest = 0.35;

const listeners = new Set<SonarListener>();
let timer = 0;
/** When the last ping sounded (seconds, performance.now()) */
let last = -Infinity;
let watching = false;

/** The detector's bars for a signal `distance` units away: 0 out of range, else 1-5 (as signalStore counts them) */
export function detectorBars(distance: number) {
  return distance < detectorRange ? Math.max(1, Math.ceil((1 - distance / detectorRange) * 5)) : 0;
}

/** Seconds between pings at `bars` (1-5) */
export const sonarInterval = (bars: number) => slowest + (fastest - slowest) * ((bars - 1) / 4);

function check() {
  const at = nearestAt();
  if (!at) {
    // Nothing in range: the next signal to come into range pings at once
    last = -Infinity;
    return;
  }
  if (document.hidden) return;
  const { x, y, z } = worldStore.camera;
  const bars = detectorBars(Math.hypot(at[0] - x, at[1] - y, at[2] - z));
  const now = performance.now() / 1000;
  if (!bars || now - last < sonarInterval(bars)) return;
  last = now;
  listeners.forEach((listener) => listener(at, bars));
}

/** Runs the detector while free roam is on and something listens */
function run() {
  const on = listeners.size > 0 && worldMode.get().mode === 'explore';
  if (on && !timer) {
    last = -Infinity;
    timer = window.setInterval(check, checkEvery);
  } else if (!on && timer) {
    window.clearInterval(timer);
    timer = 0;
  }
}

/**
 * Calls `listener` with where the nearest unfound signal is and the
 * detector's bars each time the sonar pings; returns the unsubscribe
 */
export function onSonar(listener: SonarListener) {
  if (!watching) {
    watching = true;
    worldMode.subscribe(run);
  }
  listeners.add(listener);
  run();
  return () => {
    listeners.delete(listener);
    run();
  };
}
