'use client';

import { useSyncExternalStore } from 'react';

/** Whether the "stats for nerds" overlay is open (shared by the palette and the hotkey) */
let open = false;
const listeners = new Set<() => void>();

export const statsOverlay = {
  get: () => open,
  set(next: boolean) {
    open = next;
    listeners.forEach((listener) => listener());
  },
  toggle() {
    statsOverlay.set(!open);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useStatsOverlay() {
  return useSyncExternalStore(statsOverlay.subscribe, statsOverlay.get, () => false);
}
