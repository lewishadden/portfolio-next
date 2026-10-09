'use client';

import type { QualityTier } from './quality';
import type { WorldTheme } from './utils';

/**
 * Shuttles plying the lanes between stations (`count` of them, fewer on the
 * low tier).
 *
 * Mounted in WorldCanvas ahead of its implementation: it draws nothing yet.
 */
export function Traffic(props: { theme: WorldTheme; count: number; tier: QualityTier }): null {
  void props;
  return null;
}
