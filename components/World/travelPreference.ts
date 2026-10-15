'use client';

import { useSyncExternalStore } from 'react';

export type TravelPreference = 'cinematic' | 'calm';
export const travelStorageKey = 'world-travel';

const listeners = new Set<() => void>();
let preference: TravelPreference | undefined;
let watching = false;
const serverPreference = (): TravelPreference => 'cinematic';
const parsePreference = (value: string | null): TravelPreference =>
  value === 'calm' ? 'calm' : 'cinematic';

function readStorage(): TravelPreference {
  try {
    return parsePreference(window.localStorage.getItem(travelStorageKey));
  } catch {
    return 'cinematic';
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

/** Safe for the server and frame callbacks; blocked storage keeps the in-memory choice. */
export function getTravelPreference(): TravelPreference {
  if (typeof window === 'undefined') return serverPreference();
  preference ??= readStorage();
  if (!watching) {
    watching = true;
    window.addEventListener('storage', (event) => {
      if (event.key !== travelStorageKey && event.key !== null) return;
      try {
        if (event.storageArea && event.storageArea !== window.localStorage) return;
      } catch {
        // A storage event can still carry the new value when access is blocked.
      }
      preference = event.key === null ? 'cinematic' : parsePreference(event.newValue);
      notify();
    });
  }
  return preference;
}

function subscribe(listener: () => void) {
  getTravelPreference();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setTravelPreference(value: TravelPreference) {
  if (typeof window === 'undefined') return;
  getTravelPreference();
  preference = value;
  try {
    window.localStorage.setItem(travelStorageKey, value);
  } catch {
    // The choice still applies in this tab when storage is unavailable.
  }
  notify();
}

export function useTravelPreference() {
  return useSyncExternalStore(subscribe, getTravelPreference, serverPreference);
}
