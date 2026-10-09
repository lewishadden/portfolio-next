'use client';

import { useSyncExternalStore } from 'react';

import { lockPointer, unlockPointer } from './pointerLock';
import { navigableStations } from './routes';
import { emitCue, navigateTo } from './worldStore';

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
/** The page a tour or free roam is opening, until it has arrived ('' for none) */
let pending = '';
const listeners = new Set<() => void>();

function set(next: Partial<WorldModeState>) {
  const previous = state;
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
  startTour: () => set({ mode: 'tour', tourStop: 0 }),
  /** Moves to the next stop, or ends the tour after the last one */
  advanceTour: () =>
    state.tourStop < tourStops.length - 1
      ? set({ tourStop: state.tourStop + 1 })
      : set({ mode: 'page', tourStop: 0 }),
  startExplore: () => set({ mode: 'explore' }),
  exit: () => {
    pending = '';
    unlockPointer();
    set({ mode: 'page', tourStop: 0 });
  },
};

/**
 * Opens a page from the world. Following the page, it navigates the way a
 * link does (World's navigate handler snapshots the page being left, so it
 * flies off with the camera). From the tour or free roam it navigates and
 * stays in that mode until the page has arrived (`arrivedAt`), so the camera
 * flies there as one move. The page already open isn't opened again: the
 * tour or free roam just hands the camera back to it.
 */
export function navigateFromMode(path: string) {
  if (path === window.location.pathname) {
    if (state.mode !== 'page') worldMode.exit();
    return;
  }
  if (state.mode !== 'page') pending = path;
  navigateTo(path);
}

/** World calls this on every route change: the page a mode was opening is here, so it hands back */
export function arrivedAt(pathname: string) {
  if (pending && pending === pathname) worldMode.exit();
}

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
