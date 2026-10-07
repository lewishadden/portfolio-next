import type { Object3D } from 'three';

/* ------------------------------------------------------------------
   Bloom masks. Bloom (Effects) leaves out whatever a mask covers: the
   project screens are displays, so their pages show at their own
   brightness without glowing. A mask is an invisible mesh in the plane
   of what it covers, on a layer the camera never draws; the bloom keeps
   a pixel out wherever a mask is the nearest surface there.
   ------------------------------------------------------------------ */

/** The layer masks live on (the selective bloom's selection layer) */
export const bloomMaskLayer = 10;

const masks = new Set<Object3D>();
let version = 0;

/** Keeps what `mask` covers out of bloom; returns a function that lets it back in */
export function maskBloom(mask: Object3D) {
  mask.layers.set(bloomMaskLayer);
  masks.add(mask);
  version += 1;
  return () => {
    masks.delete(mask);
    version += 1;
  };
}

export const bloomMasks = () => masks;

/** Changes whenever a mask comes or goes */
export const bloomMasksVersion = () => version;

/** Whether `object` would be drawn: it and everything above it visible */
function shown(object: Object3D) {
  for (let node: Object3D | null = object; node; node = node.parent)
    if (!node.visible) return false;
  return true;
}

/** Whether any mask is on show (a station out of range hides itself, and its masks with it) */
export function bloomMasksShown() {
  for (const mask of masks) if (shown(mask)) return true;
  return false;
}
