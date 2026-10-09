/**
 * How much the site moves. The visitor's preference (`motionPref`, saved in
 * localStorage `motion`) is `system`, which follows the OS's reduced-motion
 * setting, or a level of its own:
 *
 * - `full`: everything moves, flights included.
 * - `calm`: the page holds its motion back (no entrance animations, no
 *   sway) and the camera cuts between stations instead of flying, with no
 *   shake or lightspeed, but the world keeps rendering, so its ambient life
 *   (twinkling, nav lights, slow spins, screens cycling) carries on.
 * - `still`: nothing moves on its own; the world draws only when something
 *   changes. What `prefers-reduced-motion: reduce` gets by default.
 *
 * The level is mirrored to `html[data-motion]` (ThemeScript sets it before
 * first paint) for the SCSS mixins in `app/_motion.scss`. DOM-safe: no
 * three.js, nothing runs on import.
 */

export type MotionPref = 'system' | 'full' | 'calm' | 'still';
export type MotionLevel = 'full' | 'calm' | 'still';

/** localStorage key; ThemeScript reads it before first paint */
export const motionStorageKey = 'motion';

const osQuery = '(prefers-reduced-motion: reduce)';
const levels: readonly string[] = ['full', 'calm', 'still'] satisfies MotionLevel[];

const listeners = new Set<() => void>();
/** The saved preference, read once (storage events and setMotionPref refresh it) */
let saved: MotionPref | undefined;
/**
 * The OS setting, kept from its change events. Never read from the
 * MediaQueryList itself: Chrome drops a list's change event when its
 * `matches` was read in between (as every frame would)
 */
let osReduced = false;
let watching = false;

function readSaved(): MotionPref {
  try {
    const value = localStorage.getItem(motionStorageKey);
    return value && levels.includes(value) ? (value as MotionLevel) : 'system';
  } catch {
    // Storage blocked: the OS setting decides (or the choice made this visit)
    return 'system';
  }
}

function notify() {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-motion', motionLevel());
  }
  listeners.forEach((listener) => listener());
}

/** From the first read on: the OS setting changing, and another tab saving a choice */
function watch() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  const os = window.matchMedia(osQuery);
  osReduced = os.matches;
  os.addEventListener('change', (e) => {
    osReduced = e.matches;
    if (motionPref() === 'system') notify();
  });
  window.addEventListener('storage', (e) => {
    if (e.key !== null && e.key !== motionStorageKey) return;
    saved = readSaved();
    notify();
  });
}

/** The visitor's choice: a level, or `system` to follow the OS */
export function motionPref(): MotionPref {
  if (typeof window === 'undefined') return 'system';
  watch();
  if (saved === undefined) saved = readSaved();
  return saved;
}

/** How much moves right now (`system` resolves to `still` with OS reduced motion, else `full`). Cheap enough for every frame */
export function motionLevel(): MotionLevel {
  const pref = motionPref();
  if (pref !== 'system') return pref;
  return osReduced ? 'still' : 'full';
}

/** Saves the visitor's choice (kept for this visit even when storage is blocked) and applies it */
export function setMotionPref(pref: MotionPref) {
  motionPref();
  saved = pref;
  try {
    if (pref === 'system') localStorage.removeItem(motionStorageKey);
    else localStorage.setItem(motionStorageKey, pref);
  } catch {
    // Storage blocked: the choice still applies until the page is left
  }
  notify();
}

/** Calls `listener` whenever the level or the preference may have changed */
export function subscribeMotion(listener: () => void) {
  motionPref();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
