'use client';

import { useEffect } from 'react';
import { m } from 'framer-motion';
import { useLenis } from 'lenis/react';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useRouteKey } from '@/hooks/useRouteKey';

import './PageTransition.scss';

/**
 * Route changes: the 3D camera starts its flight immediately, a light sweep
 * crosses the viewport, and the new page de-blurs in just behind it.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  // Keyed by route, not URL — the project modal's shallow URL change must not remount the grid
  const routeKey = useRouteKey();
  const reduceMotion = useReducedMotion();
  const lenis = useLenis();

  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
  }, [routeKey, lenis]);

  return (
    <>
      {!reduceMotion && (
        <m.div
          key={`sweep-${routeKey}`}
          className="page-sweep"
          aria-hidden="true"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }}
          transition={{ duration: 1.1, times: [0, 0.55, 1], ease: [0.65, 0, 0.35, 1] }}
        />
      )}
      <m.div
        key={routeKey}
        initial={{ opacity: 0, y: reduceMotion ? 0 : 28, filter: 'blur(14px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
        transition={{ duration: 0.9, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        style={{ overflow: 'clip' }}
      >
        {children}
      </m.div>
    </>
  );
}
