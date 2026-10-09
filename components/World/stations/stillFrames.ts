'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

import { motionLevel } from '@/utils/motion';

/* ------------------------------------------------------------------
   At the `still` motion level the world draws only on demand (the
   canvas's frameloop is 'demand'), so a station that answers the page
   (a tile pointed at, a form field focused) or the pointer would not
   show it until something else repaints. These ask for the frames.
   Stations snap rather than ease at `still`, so one frame is enough.
   ------------------------------------------------------------------ */

/** Page input that can change what a station shows */
const pageInput = ['pointerover', 'pointerout', 'focusin', 'focusout', 'input'] as const;

/** At `still`, repaints the world whenever the page is pointed at, focused or typed in */
export function useStillRepaint() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const repaint = () => {
      if (motionLevel() === 'still') invalidate();
    };
    for (const type of pageInput) document.addEventListener(type, repaint, { passive: true });
    return () => {
      for (const type of pageInput) document.removeEventListener(type, repaint);
    };
  }, [invalidate]);
}

/** Draws every frame for the next `ms` (a ping, a flare), whatever the frameloop */
export function repaintFor(invalidate: () => void, ms: number) {
  const until = performance.now() + ms;
  const frame = () => {
    invalidate();
    if (performance.now() < until) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
