'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Breakpoint {
  min: number;
  cols: number;
}

const getColumns = (width: number, breakpoints: Breakpoint[]) =>
  (breakpoints.find((bp) => width >= bp.min) ?? breakpoints[breakpoints.length - 1]).cols;

/**
 * Returns a responsive column count based on viewport width and breakpoints.
 * Uses rAF-throttled resize listener for efficient updates.
 * Initializes with the smallest breakpoint value to avoid hydration mismatches.
 */
export function useColumns(breakpoints: Breakpoint[]): number {
  const [columns, setColumns] = useState(breakpoints[breakpoints.length - 1].cols);
  const rafId = useRef(0);

  const update = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      setColumns(getColumns(window.innerWidth, breakpoints));
    });
  }, [breakpoints]);

  useEffect(() => {
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      cancelAnimationFrame(rafId.current);
    };
  }, [update]);

  return columns;
}
