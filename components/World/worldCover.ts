/* ------------------------------------------------------------------
   Whether something opaque covers the whole world (the navigation
   menu, fully open), so the world can stop drawing frames nobody sees.
   DOM-safe: no three.js.
   ------------------------------------------------------------------ */

let covered = false;
const listeners = new Set<() => void>();

export const worldCover = {
  get: () => covered,
  set(next: boolean) {
    if (next === covered) return;
    covered = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
