/* ------------------------------------------------------------------
   At the `still` motion level the world draws only on demand (the
   canvas's frameloop is 'demand'), so something that plays out over time
   (a ping, a flare) would freeze after its first frame. This asks for the
   frames. A station that answers the page (a tile pointed at, a form field
   focused) asks for one frame when that changes instead
   (useRedrawOnPageChange, reaction.ts).
   ------------------------------------------------------------------ */

/** Draws every frame for the next `ms` (a ping, a flare), whatever the frameloop */
export function repaintFor(invalidate: () => void, ms: number) {
  const until = performance.now() + ms;
  const frame = () => {
    invalidate();
    if (performance.now() < until) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
