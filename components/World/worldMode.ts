'use client';

import { useSyncExternalStore } from 'react';

import { navigableStations } from './routes';

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
}

export const tourStops: readonly StationKey[] = navigableStations;

const initial: WorldModeState = { mode: 'page', tourStop: 0 };
let state = initial;
const listeners = new Set<() => void>();

function set(next: Partial<WorldModeState>) {
  state = { ...state, ...next };
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
  startTour: () => set({ mode: 'tour', tourStop: 0 }),
  /** Moves to the next stop, or ends the tour after the last one */
  advanceTour: () =>
    state.tourStop < tourStops.length - 1
      ? set({ tourStop: state.tourStop + 1 })
      : set({ mode: 'page', tourStop: 0 }),
  startExplore: () => set({ mode: 'explore' }),
  exit: () => set({ mode: 'page', tourStop: 0 }),
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
export function launchWorldMode(mode: 'tour' | 'explore', enableWorld: () => void) {
  const start = mode === 'tour' ? worldMode.startTour : worldMode.startExplore;
  if (worldReady()) {
    start();
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
