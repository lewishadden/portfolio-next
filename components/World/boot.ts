import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------
   The loading screen on a full page load. ThemeScript raises it
   (html[data-boot="loading"]) before first paint whenever the 3D world
   is going to run; the world reports its progress here as it fetches
   the 3D chunk, downloads models and warms up shaders, and says when
   it is ready. The screen then fills its bar and lifts (`finishBoot`),
   which starts the camera's warp in and the page's entrance together.
   Without the world (switched off, no WebGL, Save-Data) it never shows
   and the page starts as soon as it has hydrated. No three.js here: it
   ships with the DOM bundle.
   ------------------------------------------------------------------ */

/** What the loading screen says it is doing, step by step */
export const bootSteps = [
  'Charting the stations',
  'Loading the 3D world',
  'Bringing the stations in',
  'Warming up the engines',
  'Clear for launch',
] as const;

/** The screen is up, lifting (the intro has started underneath it), or gone */
export type BootPhase = 'loading' | 'leaving' | 'gone';

const state = {
  phase: 'loading' as BootPhase,
  /** 0..1, never goes backwards */
  progress: 0,
  /** Index into bootSteps */
  step: 0,
  /** Everything the first view needs has loaded */
  ready: false,
  /** The screen has lifted: intro animations may start */
  done: false,
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export const bootState = () => state;

export function onBoot(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Progress so far (kept below 1 until ready) and, optionally, the step it has reached */
export function reportBoot(progress: number, step = state.step) {
  if (state.ready) return;
  const next = Math.max(state.progress, Math.min(progress, 0.98));
  const nextStep = Math.max(state.step, Math.min(step, bootSteps.length - 2));
  if (next === state.progress && nextStep === state.step) return;
  state.progress = next;
  state.step = nextStep;
  notify();
}

/** Everything the first view needs has loaded: the screen fills its bar and lifts */
export function readyBoot() {
  if (state.ready) return;
  state.ready = true;
  state.progress = 1;
  state.step = bootSteps.length - 1;
  notify();
}

/** The screen lifts (or never showed): the intro starts */
export function finishBoot() {
  if (state.done) return;
  state.ready = true;
  state.progress = 1;
  state.done = true;
  state.phase = 'leaving';
  const root = document.documentElement;
  if (root.dataset.boot) root.dataset.boot = 'leaving';
  notify();
}

/** The screen has lifted out of the way */
export function clearBoot() {
  if (state.phase === 'gone') return;
  finishBoot();
  state.phase = 'gone';
  delete document.documentElement.dataset.boot;
  notify();
}

const readPhase = () => state.phase;
const serverPhase = (): BootPhase => 'loading';

export function useBootPhase() {
  return useSyncExternalStore(onBoot, readPhase, serverPhase);
}

export const isBooted = () => state.done;

/** Runs `callback` once the screen has lifted (at once if it has); returns a cancel */
export function whenBooted(callback: () => void) {
  if (state.done) {
    callback();
    return () => {};
  }
  const stop = onBoot(() => {
    if (!state.done) return;
    stop();
    callback();
  });
  return stop;
}

const serverBooted = () => false;

/** True once the loading screen has lifted, so entrance animations can play */
export function useBooted() {
  return useSyncExternalStore(onBoot, isBooted, serverBooted);
}
