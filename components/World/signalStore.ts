import { useSyncExternalStore } from 'react';

import { githubRepoUrl } from 'config';

import { stationPositions } from './routes';

/* ------------------------------------------------------------------
   Signals: five things hidden out in the world for free roam to find,
   off the line of stations. Flying close to one finds it: the HUD shows
   what it says (some carry something: the CV, the source code), counts
   how many of the five you have found (remembered between visits), and
   a detector warms up as you get near one you haven't. The canvas side
   (Signals.tsx) draws them and reports distances here. No three.js: the
   HUD uses this.
   ------------------------------------------------------------------ */

export type SignalAction =
  | { kind: 'page'; label: string; href: string }
  | { kind: 'link'; label: string; href: string }
  | { kind: 'cv'; label: string };

export interface Signal {
  id: 'probe' | 'derelict' | 'capsule' | 'relay' | 'comet';
  name: string;
  message: string;
  /** Where it drifts (the comet orbits round it instead, see cometAt) */
  position: [number, number, number];
  /** How close you have to fly to find it */
  reach: number;
  action?: SignalAction;
}

export const signals: readonly Signal[] = [
  {
    id: 'probe',
    name: 'Pioneer probe',
    message:
      'Launched in 2017 with my first production React app. Its plaque still reads: ship it, measure it, make it better.',
    position: [-104, 28, -24],
    reach: 12,
  },
  {
    id: 'derelict',
    name: 'The derelict',
    message:
      "Every wrong turn on this site ends up out here. If a link ever sends you somewhere strange, tell me and I'll fix it.",
    position: stationPositions.lost,
    reach: 18,
    action: { kind: 'page', label: 'Report it', href: '/contact' },
  },
  {
    id: 'capsule',
    name: 'Supply capsule',
    message: 'Cargo manifest: one CV, two pages, nine years of building for the web.',
    position: [74, -34, -196],
    reach: 12,
    action: { kind: 'cv', label: 'Download the CV' },
  },
  {
    id: 'relay',
    name: 'Open-source relay',
    message:
      'Everything you are flying through is open source: Next.js, React Three Fiber and a lot of shader maths.',
    position: [-88, -38, -262],
    reach: 12,
    action: { kind: 'link', label: 'Read the code', href: githubRepoUrl },
  },
  {
    id: 'comet',
    name: 'Comet LH-26',
    message: "You caught a comet. That's the kind of persistence I bring to a team.",
    position: [0, 64, -112],
    reach: 14,
  },
];

export const signalCount = signals.length;

/** A point in the world: three's Vector3 is one, so canvas code can pass its own */
export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

/** The comet's orbit round its signal's position: radii and period (s) */
export const cometOrbit = { x: 170, y: 24, z: 120, period: 150 };
const cometCentre = signals.find((signal) => signal.id === 'comet')!.position;

/**
 * Where the comet is at clock time `t` (the world canvas's clock: see
 * `signalTime`), written into `out` (a fresh point by default)
 */
export function cometAt<T extends WorldPoint = WorldPoint>(
  t: number,
  out: T = { x: 0, y: 0, z: 0 } as T
): T {
  const angle = (t / cometOrbit.period) * Math.PI * 2;
  out.x = cometCentre[0] + Math.cos(angle) * cometOrbit.x;
  out.y = cometCentre[1] + Math.sin(angle * 2) * cometOrbit.y;
  out.z = cometCentre[2] + Math.sin(angle) * cometOrbit.z;
  return out;
}

/** The clock time the canvas last placed the signals at (Signals.tsx), for DOM code following the comet */
let clockTime = 0;

export function setSignalTime(t: number) {
  clockTime = t;
}

/** The clock time the comet was last placed for: `cometAt(signalTime())` is where it is drawn */
export const signalTime = () => clockTime;

/** Where a signal is now (the comet moves along its orbit) */
export function signalAt(signal: Signal, out: WorldPoint = { x: 0, y: 0, z: 0 }) {
  if (signal.id === 'comet') return cometAt(clockTime, out);
  [out.x, out.y, out.z] = signal.position;
  return out;
}

/** What the last signal said once you have found them all */
export const allFound: Pick<Signal, 'name' | 'message' | 'action'> = {
  name: 'All signals found',
  message: "You found all five. You're thorough, and I look for that in the people I work with.",
  action: { kind: 'page', label: 'Say hello', href: '/contact' },
};

/** Detector range (world units) and its bars */
export const detectorRange = 170;
const detectorBars = 5;

const storageKey = 'signals';
let found: readonly string[] | undefined;
let latest = '';
/** The last signal found this visit, whether or not its card is still up */
let recent: Signal['id'] | '' = '';
let bars = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function readFound(): readonly string[] {
  if (found) return found;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    found = Array.isArray(stored) ? stored.filter((id) => signals.some((s) => s.id === id)) : [];
  } catch {
    found = [];
  }
  return found;
}

export const isFound = (id: string) => readFound().includes(id);

/** Records a find; true if it is new (the HUD then shows what the signal says) */
export function markFound(id: Signal['id']) {
  if (isFound(id)) return false;
  found = [...readFound(), id];
  latest = id;
  recent = id;
  try {
    localStorage.setItem(storageKey, JSON.stringify(found));
  } catch {
    // Storage blocked: remembered until reload
  }
  notify();
  return true;
}

/** Closes the card for the latest find */
export function dismissFound() {
  if (!latest) return;
  latest = '';
  notify();
}

/** The last signal found this visit ('' for none), whether or not its card is still up */
export const recentFound = () => recent;

/** Shows the card for the last signal found this visit again, if one was */
export function reopenFound() {
  if (!recent || latest === recent) return;
  latest = recent;
  notify();
}

/** Where the nearest unfound signal is while one is in detector range */
let nearest: readonly [number, number, number] | null = null;

/**
 * The detector: distance to the nearest signal not yet found (Infinity for
 * none), and where it is (for the sonar to sound from)
 */
export function reportNearest(distance: number, at?: readonly [number, number, number]) {
  nearest = distance < detectorRange && at ? at : null;
  const next =
    distance < detectorRange
      ? Math.max(1, Math.ceil((1 - distance / detectorRange) * detectorBars))
      : 0;
  if (next === bars) return;
  bars = next;
  notify();
}

/** Where the nearest unfound signal is, or null when none is in detector range */
export function nearestAt() {
  return nearest;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const none: readonly string[] = [];

export function useFoundSignals() {
  return useSyncExternalStore(subscribe, readFound, () => none);
}

/** The signal just found, until its card is closed ('' for none) */
export function useLatestSignal() {
  return useSyncExternalStore(
    subscribe,
    () => latest,
    () => ''
  );
}

/** 0 when nothing unfound is in range, else 1-5 bars as you close in */
export function useDetector() {
  return useSyncExternalStore(
    subscribe,
    () => bars,
    () => 0
  );
}
