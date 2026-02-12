'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Returns `true` when the header should be visible (pinned).
 * The header is pinned when:
 *  - The user is at the top of the page
 *  - The user is scrolling up
 * The header is unpinned (hidden) when the user scrolls down past a threshold.
 *
 * Uses requestAnimationFrame to throttle scroll event processing.
 */
export function useHeadroom({ fixedAt = 0 }: { fixedAt?: number } = {}): boolean {
  const [pinned, setPinned] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    if (ticking.current) return;

    ticking.current = true;
    requestAnimationFrame(() => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= fixedAt) {
        setPinned(true);
      } else if (currentScrollY < lastScrollY.current) {
        setPinned(true);
      } else if (currentScrollY > lastScrollY.current) {
        setPinned(false);
      }

      lastScrollY.current = currentScrollY;
      ticking.current = false;
    });
  }, [fixedAt]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return pinned;
}
