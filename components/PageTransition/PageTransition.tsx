'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { m, useAnimationControls } from 'framer-motion';
import { useLenis } from 'lenis/react';
import { usePathname } from 'next/navigation';

import { whenBooted } from '@/components/World/boot';
import { stationForPath } from '@/components/World/routes';
import { onFlight } from '@/components/World/worldStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useRouteKey } from '@/hooks/useRouteKey';
import { releaseSnapshot, watchNavigation, worldIsLive } from './pageSnapshot';

import type { StationKey } from '@/components/World/routes';

import './PageTransition.scss';

/** Longest the copy waits for the camera before showing anyway */
const maxHold = 6500;

/**
 * Route changes: a light sweep crosses the viewport and the new page
 * de-blurs in. With the 3D world on, the copy waits for the camera: it
 * arrives as the flight makes its final approach, rather than appearing
 * over empty space, and the page you left goes with the camera (a still
 * copy rushing past or swinging away, see pageSnapshot). The first page
 * load enters as the loading screen lifts.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  // Keyed by route, not URL: the project modal's shallow URL change must not remount the grid
  const routeKey = useRouteKey();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const lenis = useLenis();
  const controls = useAnimationControls();
  const station = useRef<StationKey | null>(null);
  const route = useRef<string | null>(null);
  const flight = useRef(false);

  // Link clicks and Back / Forward snapshot the page they leave
  useEffect(() => watchNavigation(), []);

  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
  }, [routeKey, lenis]);

  // Before paint, so the page you left never blinks out: is the camera
  // flying? If it is, that page's snapshot takes its place and leaves with it
  useLayoutEffect(() => {
    const previous = station.current;
    const next = stationForPath(pathname);
    station.current = next;
    flight.current = previous !== null && previous !== next && !reduceMotion && worldIsLive();
    releaseSnapshot(next, flight.current);
    // ThemeScript's failsafe showed the page that loaded before the app did; the next runs as usual
    if (route.current !== null && route.current !== routeKey) {
      delete document.documentElement.dataset.failsafe;
    }
    route.current = routeKey;
  }, [routeKey, pathname, reduceMotion]);

  useEffect(() => {
    const next = station.current;
    if (!flight.current) {
      // A full page load enters as the loading screen lifts
      return whenBooted(() => controls.start('visible'));
    }
    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      controls.start('visible');
    };
    const stop = onFlight((event, to) => {
      if (to === next && event !== 'start') show();
    });
    const timer = window.setTimeout(show, maxHold);
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [routeKey, pathname, reduceMotion, controls]);

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
        initial="hidden"
        animate={controls}
        variants={{
          hidden: { opacity: 0, y: reduceMotion ? 0 : 28, filter: 'blur(14px)' },
          visible: {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            transitionEnd: { filter: 'none' },
            transition: { duration: 0.9, delay: 0.18, ease: [0.16, 1, 0.3, 1] },
          },
        }}
        style={{ overflow: 'clip' }}
      >
        {children}
      </m.div>
    </>
  );
}
