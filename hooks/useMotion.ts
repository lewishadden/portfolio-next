'use client';

import { useSyncExternalStore } from 'react';

import { motionLevel, motionPref, subscribeMotion } from '@/utils/motion';

import type { MotionLevel, MotionPref } from '@/utils/motion';

/**
 * How much the site moves right now: `full`, `calm` or `still` (see
 * utils/motion.ts). `full` during SSR and hydration.
 */
export function useMotionLevel(): MotionLevel {
  return useSyncExternalStore(subscribeMotion, motionLevel, () => 'full');
}

/** The visitor's motion choice, `system` included (for controls that show it) */
export function useMotionPref(): MotionPref {
  return useSyncExternalStore(subscribeMotion, motionPref, () => 'system');
}
