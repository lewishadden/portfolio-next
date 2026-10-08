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
  /** Where it drifts (the comet orbits instead, see Signals.tsx) */
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
let bars = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function readFound(): readonly string[] {
  if (found) return found;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    found = Array.isArray(stored)
      ? [...new Set(stored.filter((id) => signals.some((s) => s.id === id)))]
      : [];
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

/** Opens a previously found transmission without revealing an undiscovered signal. */
export function reopenFound(id: Signal['id']) {
  if (!isFound(id)) return false;
  latest = id;
  notify();
  return true;
}

export const signalLogEvent = 'world:signal-log';

export function openSignalLog() {
  window.dispatchEvent(new Event(signalLogEvent));
}

/** The detector: distance to the nearest signal not yet found (Infinity for none) */
export function reportNearest(distance: number) {
  const next =
    distance < detectorRange
      ? Math.max(1, Math.ceil((1 - distance / detectorRange) * detectorBars))
      : 0;
  if (next === bars) return;
  bars = next;
  notify();
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
