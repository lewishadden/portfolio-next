'use client';

import { useMotionLevel } from './useMotion';

/**
 * Returns `true` when motion is held back: the `calm` or `still` level (the
 * visitor's choice, or the OS's reduced-motion setting; see utils/motion.ts).
 * Returns `false` during SSR.
 */
export function useReducedMotion(): boolean {
  return useMotionLevel() !== 'full';
}
