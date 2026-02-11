'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `true` when the user prefers reduced motion.
 * Returns `false` during SSR.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mql.matches);

    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduceMotion;
}
