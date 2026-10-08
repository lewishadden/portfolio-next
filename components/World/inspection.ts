'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { unlockPointer } from './pointerLock';
import { stationKeys } from './routes';
import { exploreInput, worldStore, worldTip } from './worldStore';

import type { InspectionCatalog, InspectionSelection } from './inspectionTypes';
import type { StationKey } from './routes';

let selected: InspectionSelection | null = null;
let cameraHeld = false;
let returnFocus: HTMLElement | null = null;
let returnPath = '';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const serverSelection = () => null;

/** Clear every flight axis, including held touch sticks and accumulated mouse deltas. */
function releaseControls() {
  unlockPointer();
  Object.assign(exploreInput, {
    forward: 0,
    strafe: 0,
    lift: 0,
    turn: 0,
    boost: false,
    lookX: 0,
    lookY: 0,
    steerX: 0,
    steerY: 0,
    stickX: 0,
    stickY: 0,
  });
  worldStore.velocity = 0;
  worldStore.shake = 0;
  worldStore.docking = '';
  worldTip.set(null);
  if (typeof document !== 'undefined') delete document.documentElement.dataset.worldHover;
}

function setSelection(next: InspectionSelection | null) {
  if (selected === next) return;
  if (next && !selected && typeof HTMLElement !== 'undefined') {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    returnPath = window.location.pathname;
  }
  selected = next;
  if (next) releaseControls();
  if (typeof document !== 'undefined') {
    if (next) document.documentElement.dataset.inspection = next.kind;
    else delete document.documentElement.dataset.inspection;
  }
  notify();
  if (!next && returnFocus) {
    const opener = returnFocus;
    const path = returnPath;
    returnFocus = null;
    const restore = (attempt: number) => {
      if (selected || window.location.pathname !== path || !opener.isConnected) return;
      if (!opener.closest('[inert], [hidden]')) opener.focus({ preventScroll: true });
      else if (attempt < 3) window.requestAnimationFrame(() => restore(attempt + 1));
    };
    window.requestAnimationFrame(() => restore(0));
  }
}

export const inspection = {
  get: () => selected,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const isInspecting = () => selected !== null;

/** Camera ownership includes the return transition, after the dialog has closed. */
export const inspectionOwnsCamera = () => selected !== null || cameraHeld;

export function setInspectionCameraHeld(held: boolean) {
  if (cameraHeld === held) return;
  cameraHeld = held;
  notify();
}

export function useInspection() {
  return useSyncExternalStore(inspection.subscribe, inspection.get, serverSelection);
}

/** Keep the canonical route and all unrelated query parameters/hash intact. */
export function inspectEntity(selection: InspectionSelection) {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    const value = `${selection.kind}:${selection.id}`;
    if (url.searchParams.get('inspect') !== value) {
      const wasInspecting = url.searchParams.has('inspect');
      url.searchParams.set('inspect', value);
      const state = {
        ...window.history.state,
        // Only entries created here may go Back when the close button is used.
        ...(wasInspecting ? {} : { portfolioInspection: url.pathname }),
      };
      if (wasInspecting) window.history.replaceState(state, '', url);
      else window.history.pushState(state, '', url);
    }
  }
  setSelection(selection);
}

export function closeInspection({ replace = false }: { replace?: boolean } = {}) {
  setSelection(null);
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('inspect')) return;
  if (!replace && window.history.state?.portfolioInspection === url.pathname) {
    window.history.back();
    return;
  }
  url.searchParams.delete('inspect');
  const state = { ...window.history.state };
  delete state.portfolioInspection;
  window.history.replaceState(state, '', url);
}

/** Resolve shareable IDs only after the server-provided content catalog exists. */
export function selectionFromLocation(catalog: InspectionCatalog): InspectionSelection | null {
  const value = new URL(window.location.href).searchParams.get('inspect');
  if (!value) return null;
  const colon = value.indexOf(':');
  if (colon < 1) return null;
  const kind = value.slice(0, colon);
  const id = value.slice(colon + 1);
  if (kind === 'project' && catalog.projects.some((project) => project.id === id)) {
    return { kind, id, station: 'projects' };
  }
  if (kind === 'skill' && catalog.skills.some((skill) => skill.id === id)) {
    return { kind, id, station: 'skills' };
  }
  if (kind === 'role' && catalog.roles.some((role) => role.id === id)) {
    return { kind, id, station: 'experience' };
  }
  if (kind === 'station' && stationKeys.includes(id as StationKey)) {
    return { kind, id, station: id as StationKey };
  }
  return null;
}

/** The persistent World owns history, so direct links also work with WebGL disabled. */
export function useInspectionHistory(catalog: InspectionCatalog, pathname: string) {
  useEffect(() => {
    const read = () => {
      const next = selectionFromLocation(catalog);
      if (next?.kind === selected?.kind && next?.id === selected?.id) return;
      setSelection(next);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isInspecting() || event.defaultPrevented) return;
      // A palette or another dialog opened above the inspector owns its first
      // Escape. Do not close the underlying selection through that interface.
      const otherOwner = [
        ...document.querySelectorAll('[data-world-input-owner], [role="dialog"], dialog[open]'),
      ].some(
        (owner) =>
          !owner.closest('[data-inspection-panel], [hidden], [inert], [aria-hidden="true"]')
      );
      if (otherOwner) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeInspection();
    };
    read();
    window.addEventListener('popstate', read);
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('popstate', read);
      window.removeEventListener('keydown', escape, true);
    };
  }, [catalog, pathname]);
}
