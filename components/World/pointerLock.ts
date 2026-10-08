import { useSyncExternalStore } from 'react';

let rejected = false;
let pending = false;
const availabilityListeners = new Set<() => void>();

/* ------------------------------------------------------------------
   Free roam steers like a flight sim: the pointer is locked, so the
   cursor never drifts off the middle of the screen and every movement
   of the mouse turns the view at once. Esc (the browser's own key)
   frees the mouse for the HUD; a click on open space takes it back.
   No three.js here: the HUD and the mode store use it too.
   ------------------------------------------------------------------ */

/** Mice only: touch has no pointer to lock, and drags the view instead */
export function canLockPointer() {
  return (
    typeof document !== 'undefined' &&
    !rejected &&
    'requestPointerLock' in document.documentElement &&
    window.matchMedia('(pointer: fine)').matches
  );
}

/** Needs a user gesture (a click or key press); quietly does nothing otherwise */
export function lockPointer() {
  if (!canLockPointer() || document.pointerLockElement || pending) return;
  pending = true;
  const cleanup = () => {
    pending = false;
    document.removeEventListener('pointerlockerror', fail);
    document.removeEventListener('pointerlockchange', changed);
  };
  const fail = () => {
    cleanup();
    // A denied API is unavailable for this visit. Open-space mouse steering
    // takes over, and later HUD clicks never repeat the failed request.
    rejected = true;
    availabilityListeners.forEach((listener) => listener());
  };
  const changed = () => {
    if (document.pointerLockElement) cleanup();
  };
  document.addEventListener('pointerlockerror', fail);
  document.addEventListener('pointerlockchange', changed);
  try {
    const request = document.body.requestPointerLock() as unknown as Promise<void> | undefined;
    request?.catch?.(fail);
  } catch {
    fail();
  }
}

export function unlockPointer() {
  if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
}

const subscribe = (listener: () => void) => {
  document.addEventListener('pointerlockchange', listener);
  return () => document.removeEventListener('pointerlockchange', listener);
};
const locked = () => !!document.pointerLockElement;
const serverLocked = () => false;

const subscribeAvailability = (listener: () => void) => {
  availabilityListeners.add(listener);
  const media = window.matchMedia('(pointer: fine)');
  media.addEventListener('change', listener);
  return () => {
    availabilityListeners.delete(listener);
    media.removeEventListener('change', listener);
  };
};

/** Includes request failures, so hints and steering agree about availability. */
export function useCanLockPointer() {
  return useSyncExternalStore(subscribeAvailability, canLockPointer, serverLocked);
}

/** Whether the pointer is locked right now */
export function usePointerLocked() {
  return useSyncExternalStore(subscribe, locked, serverLocked);
}

