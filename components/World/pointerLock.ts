import { useSyncExternalStore } from 'react';

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
    'requestPointerLock' in document.documentElement &&
    window.matchMedia('(pointer: fine)').matches
  );
}

/** Needs a user gesture (a click or key press); quietly does nothing otherwise */
export function lockPointer() {
  if (!canLockPointer() || document.pointerLockElement) return;
  try {
    const request = document.body.requestPointerLock() as unknown as Promise<void> | undefined;
    request?.catch?.(() => undefined);
  } catch {
    // Not allowed here (no gesture, a sandboxed frame): the mouse stays free
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

/** Whether the pointer is locked right now */
export function usePointerLocked() {
  return useSyncExternalStore(subscribe, locked, serverLocked);
}
