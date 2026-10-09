'use client';

import type { StationKey } from './routes';
import type { WorldTheme } from './utils';

/**
 * The station projects the page heading into space as the camera arrives.
 *
 * Mounted in WorldCanvas ahead of its implementation: it draws nothing yet.
 */
export function HeadingProjector(props: { theme: WorldTheme; station: StationKey }): null {
  void props;
  return null;
}
