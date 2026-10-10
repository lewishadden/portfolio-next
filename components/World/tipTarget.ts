import type { Object3D } from 'three';

/* ------------------------------------------------------------------
   The 3D object the tooltip (worldTip) names, so TipProbe can pin the
   label to it: whatever sets a tip on hover calls setTipTarget with the
   object hovered (and its instance, for an instanced mesh), and null
   when the hover ends. Without one, TipProbe falls back on the object
   R3F has under the pointer. Canvas side: it holds three.js objects.
   ------------------------------------------------------------------ */

const target: { object: Object3D | null; instance: number } = { object: null, instance: -1 };

/** Names the object the tip is about (`instance` for one instance of an InstancedMesh) */
export function setTipTarget(object: Object3D | null, instance = -1) {
  target.object = object;
  target.instance = object ? instance : -1;
}

/** The object set for the tip, while it is still in the scene (null otherwise) */
export function tipTarget(): Readonly<typeof target> | null {
  const { object } = target;
  if (!object) return null;
  // Removed from the scene since (a station unmounted): forget it
  if (!object.parent) {
    setTipTarget(null);
    return null;
  }
  return target;
}
