'use client';

import { useSyncExternalStore } from 'react';

import { lockPointer, unlockPointer } from './pointerLock';
import { navigableStations, stationForPath } from './routes';
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
  /** Index into tourStops of the stop on show while touring */
  tourStop: number;
  /**
   * How many stops the tour has shown before this one (0 for the first,
   * which reads 01 whichever station it is). `tourStops.length` once the
   * last stop is done: the closing card, still at the last stop
   */
  tourStep: number;
}

export const tourStops: readonly StationKey[] = navigableStations;

const initial: WorldModeState = { mode: 'page', tourStop: 0, tourStep: 0 };
let state = initial;
/** The page a tour or free roam is opening, until it has arrived ('' for none) */
let pending = '';
/**
 * Where keyboard focus goes when the page is back: the control that had it
 * when the tour or free roam started, or the page itself ('page') when the
 * mode opened another page. See restoreFocus
 */
let returnFocus: Element | 'page' | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<WorldModeState>) {
  const previous = state;
  state = { ...state, ...next };
  if (previous.mode === 'page' && state.mode !== 'page' && typeof document !== 'undefined') {
    returnFocus = document.activeElement;
  }
  if (state.mode !== previous.mode) emitCue(state.mode === 'page' ? 'blip' : 'select');
  else if (state.tourStep !== previous.tourStep) emitCue('blip');
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
  /**
   * Starts the tour at `from` (by default the station on show), so the
   * camera sets off from where it is, and visits every stop from there,
   * round to the one before it
   */
  startTour: (from?: StationKey) => {
    const at = tourStops.indexOf(from ?? stationForPath(window.location.pathname));
    set({ mode: 'tour', tourStop: Math.max(0, at), tourStep: 0 });
  },
  /** Moves to the next stop, or after the last one to the closing card */
  advanceTour: () => {
    const { mode, tourStop, tourStep } = state;
    if (mode !== 'tour' || tourStep >= tourStops.length) return;
    if (tourStep === tourStops.length - 1) set({ tourStep: tourStep + 1 });
    else set({ tourStop: (tourStop + 1) % tourStops.length, tourStep: tourStep + 1 });
  },
  /** Back to the stop before (from the closing card, the last stop) */
  backTour: () => {
    const { mode, tourStop, tourStep } = state;
    if (mode !== 'tour' || tourStep === 0) return;
    if (tourStep === tourStops.length) set({ tourStep: tourStep - 1 });
    else {
      set({
        tourStop: (tourStop - 1 + tourStops.length) % tourStops.length,
        tourStep: tourStep - 1,
      });
    }
  },
  startExplore: () => set({ mode: 'explore' }),
  exit: () => {
    pending = '';
    unlockPointer();
    set({ mode: 'page', tourStop: 0, tourStep: 0 });
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
  if (!pending || pending !== pathname) return;
  // A new page: what had focus is gone, so the page itself takes it
  returnFocus = 'page';
  worldMode.exit();
}

const focusable = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement &&
  el !== document.body &&
  el.isConnected &&
  !el.closest('[inert]') &&
  el.getClientRects().length > 0;

/**
 * The page is back from the tour or free roam (World calls this a frame
 * after it stops being inert): keyboard focus returns to the control that
 * started the mode, or failing that the free roam button, or the page
 * (#main-content, focusable but out of the tab order). After the mode
 * opened another page, the page itself. Without it focus is left on the
 * body, since the tour card or the HUD that had it is gone. Only then:
 * focus the visitor has since moved somewhere live stays put (the command
 * palette, opened while the camera flew back, keeps its input)
 */
export function restoreFocus() {
  const target = returnFocus;
  returnFocus = null;
  if (!target || state.mode !== 'page' || focusable(document.activeElement)) return;
  const main = document.getElementById('main-content');
  const choices = target === 'page' ? [main] : [target, document.querySelector('.roam-fab'), main];
  for (const el of choices) {
    if (!focusable(el)) continue;
    if (el === main && !el.hasAttribute('tabindex')) el.tabIndex = -1;
    el.focus({ preventScroll: true });
    if (document.activeElement === el) return;
  }
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
  const start = () => (mode === 'tour' ? worldMode.startTour() : worldMode.startExplore());
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
