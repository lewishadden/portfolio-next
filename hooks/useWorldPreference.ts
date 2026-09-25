'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** localStorage key; ThemeScript reads it before hydration to avoid a flash */
export const worldStorageKey = 'world';

const listeners = new Set<() => void>();
/** In-memory copy of the choice, so it applies even when storage is blocked */
let override: boolean | undefined;

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== worldStorageKey) return;
    override = undefined; // another tab changed it — storage is the truth again
    callback();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', onStorage);
  };
}

function readEnabled() {
  if (override !== undefined) return override;
  try {
    return localStorage.getItem(worldStorageKey) !== 'off';
  } catch {
    return true;
  }
}

let support: boolean | undefined;

/** WebGL available and Save-Data off — probed once per page load */
function readSupported() {
  if (support !== undefined) return support;
  try {
    const canvas = document.createElement('canvas');
    const webgl = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    support = webgl && !connection?.saveData;
  } catch {
    support = false;
  }
  return support;
}

const noSubscribe = () => () => {};

/**
 * Whether the 3D world may run: the device can (`supported`) and the visitor
 * has not switched it off (`enabled`, persisted). SSR-safe — the server
 * renders as "enabled but unsupported", i.e. the static fallback.
 */
export function useWorldPreference() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => true);
  const supported = useSyncExternalStore(noSubscribe, readSupported, () => false);

  const setEnabled = useCallback((next: boolean) => {
    override = next;
    try {
      if (next) localStorage.removeItem(worldStorageKey);
      else localStorage.setItem(worldStorageKey, 'off');
    } catch {
      // Storage blocked — the choice still applies until reload
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { enabled, supported, setEnabled };
}
