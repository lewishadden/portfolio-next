'use client';

import { useSelectedLayoutSegments } from 'next/navigation';

/**
 * Identifies the rendered route rather than the URL. Shallow URL updates
 * (`history.pushState`, e.g. the project modal writing /projects/<slug>) keep
 * the same key, so they don't replay page transitions or scroll resets.
 */
export function useRouteKey() {
  return `/${useSelectedLayoutSegments().join('/')}`;
}
