'use client';

import { useSyncExternalStore } from 'react';

import { closeInspection, isInspecting } from './inspection';
import { lockPointer, unlockPointer } from './pointerLock';
import { navigableStations } from './routes';
import { emitCue } from './worldStore';

import type { StationKey } from './routes';

/**
 * What the world is doing: following the page ('page'), flying the guided
 * tour ('tour'), or handing the camera to the visitor ('explore'). A tiny
 * external store so the header, overlays and the canvas share it without
 * re-rendering the page. No three.js imports: it ships with the DOM bundle.
 */
export type WorldMode = 'page' | 'tour' | 'explore';

export interface WorldModeState {
  mode: WorldMode;
  /** Index into tourStops while touring */
  tourStop: number;
  /** An explicit hold is independent of the caption's hover/focus hold. */
  tourHeld: boolean;
  /** Last unfinished stop, retained when visiting a page or leaving the tour. */
  tourResume: number | null;
  tourSession: number;
}

export const tourStops: readonly StationKey[] = navigableStations;

const initial: WorldModeState = {
  mode: 'page',
  tourStop: 0,
  tourHeld: false,
  tourResume: null,
  tourSession: 0,
};
let state = initial;
const listeners = new Set<() => void>();

function set(next: Partial<WorldModeState>) {
  const previous = state;
  if (
    previous.mode === 'tour' &&
    next.mode &&
    next.mode !== 'tour' &&
    next.tourResume === undefined
  ) {
    next = { tourResume: previous.tourStop, ...next };
  }
  state = { ...state, ...next };
  if (state.mode !== previous.mode) emitCue(state.mode === 'page' ? 'blip' : 'select');
  else if (state.tourStop !== previous.tourStop) emitCue('blip');
  listeners.forEach((listener) => listener());
}

export const worldMode = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  startTour: () =>
    set({ mode: 'tour', tourStop: 0, tourHeld: false, tourSession: state.tourSession + 1 }),
  resumeTour: () =>
    set({
      mode: 'tour',
      tourStop: state.tourResume ?? 0,
      tourHeld: false,
      tourSession: state.tourSession + 1,
    }),
  holdTour: () => set({ tourHeld: true }),
  resumeCountdown: () => set({ tourHeld: false }),
  previousTour: () => set({ tourStop: Math.max(0, state.tourStop - 1) }),
  /** Moves to the next stop, or ends the tour after the last one */
  advanceTour: () =>
    state.tourStop < tourStops.length - 1
      ? set({ tourStop: state.tourStop + 1 })
      : set({ mode: 'page', tourStop: 0, tourHeld: false, tourResume: null }),
  startExplore: () => set({ mode: 'explore' }),
  exit: () => {
    unlockPointer();
    set({ mode: 'page', tourStop: 0 });
  },
};

export function useWorldMode() {
  return useSyncExternalStore(worldMode.subscribe, worldMode.get, () => initial);
}

const worldReady = () =>
  document.documentElement.dataset.world === 'on' && !!document.querySelector('.world--ready');

/**
 * Starts the tour or explore mode, first turning the 3D world on (and
 * waiting for it to appear) if the visitor had switched it off.
 */
export function launchWorldMode(mode: 'tour' | 'explore', enableWorld: () => void, resume = false) {
  if (isInspecting()) closeInspection({ replace: true });
  const start =
    mode === 'tour'
      ? resume
        ? worldMode.resumeTour
        : worldMode.startTour
      : worldMode.startExplore;
  if (worldReady()) {
    start();
    // Still inside the click or key press that asked for it, which the lock needs
    if (mode === 'explore') lockPointer();
    return;
  }
  enableWorld();
  const began = Date.now();
  const timer = window.setInterval(() => {
    if (worldReady()) {
      window.clearInterval(timer);
      start();
    } else if (Date.now() - began > 9000) window.clearInterval(timer);
  }, 150);
}
