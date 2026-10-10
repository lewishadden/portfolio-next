'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { useLenis } from 'lenis/react';
import { usePathname } from 'next/navigation';

import { whenBooted } from '@/components/World/boot';
import { stationForPath } from '@/components/World/routes';
import { onFlight, worldStore } from '@/components/World/worldStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useRouteKey } from '@/hooks/useRouteKey';
import {
  copyHeldFor,
  holdCopy,
  releaseSnapshot,
  watchNavigation,
  worldOnScreen,
} from './pageSnapshot';

import type { StationKey } from '@/components/World/routes';

import './PageTransition.scss';

/** Longest the copy waits for the camera before showing anyway */
const maxHold = 6500;

/** Where the copy comes in from, following the flight that brought it */
interface Arrival {
  x: string;
  y: number;
  scale: number;
  rotateY: number;
}

/** Flown straight in: the copy rushes up to meet the camera */
const rushIn: Arrival = { x: '0vw', y: 16, scale: 0.94, rotateY: 0 };

/**
 * An about-turn, `turn` being the way the camera set off (worldStore's
 * flight.turn, +1 left). By the approach it is rounding the station the
 * other way (flight.ts: two opposite half turns), so the copy swings in from
 * the side it is turning towards then (set off left, rounding right: in from
 * the right), turned away in perspective. That is the side the page it left
 * went off by (pageSnapshot's swing): both move with the view
 */
const swingIn = (turn: number): Arrival => ({
  x: `${turn * 8}vw`,
  y: 0,
  scale: 1,
  rotateY: turn * -7,
});

const reveal = {
  duration: 0.9,
  delay: 0.18,
  ease: [0.16, 1, 0.3, 1],
} as const;

/**
 * Route changes: a light sweep crosses the viewport and the new page
 * de-blurs in. With the 3D world on, the copy waits for the camera: it
 * arrives as the flight makes its final approach, rather than appearing
 * over empty space, and the page you left goes with the camera (a still
 * copy rushing past or swinging away, see pageSnapshot). The first page
 * load enters as the loading screen lifts.
 *
 * The reveal is state, not an imperative animation start: a remount of the
 * keyed wrapper (StrictMode in development) resets it to its initial
 * "hidden" and would drop a one-off start, leaving the page invisible. It
 * starts over on every navigation, even back to the route last shown (off
 * to another page and straight back, before that flight was on approach):
 * that copy waits for the camera again.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  // Keyed by route, not URL: the project modal's shallow URL change must not remount the grid
  const routeKey = useRouteKey();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const lenis = useLenis();
  const [shownRoute, setShownRoute] = useState<{
    route: string;
    shown: boolean;
    arrival: Arrival | null;
  }>({ route: routeKey, shown: false, arrival: null });
  // Reset while rendering, so the new route never renders a frame as shown
  if (shownRoute.route !== routeKey)
    setShownRoute({ route: routeKey, shown: false, arrival: null });
  const shown = shownRoute.route === routeKey && shownRoute.shown;
  const station = useRef<StationKey | null>(null);
  const route = useRef<string | null>(null);
  const flight = useRef(false);

  // Link clicks and Back / Forward snapshot the page they leave
  useEffect(() => watchNavigation(), []);

  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
  }, [routeKey, lenis]);

  // Before paint, so the page you left never blinks out: is the camera
  // flying? If it is, that page's snapshot takes its place and leaves with it.
  // A page opened from the tour or free roam (Visit, docking) waits for the
  // camera too, though nothing was snapshotted: the page was hidden
  useLayoutEffect(() => {
    const previous = station.current;
    const next = stationForPath(pathname);
    station.current = next;
    flight.current = previous !== null && previous !== next && !reduceMotion && worldOnScreen();
    holdCopy(flight.current ? next : null);
    releaseSnapshot(next, flight.current);
    // ThemeScript's failsafe showed the page that loaded before the app did; the next runs as usual
    if (route.current !== null && route.current !== routeKey) {
      delete document.documentElement.dataset.failsafe;
    }
    route.current = routeKey;
  }, [routeKey, pathname, reduceMotion]);

  useEffect(() => {
    const next = station.current;
    const show = (arrival: Arrival | null = null) => {
      if (copyHeldFor() === next) holdCopy(null);
      setShownRoute((current) =>
        current.route === routeKey && !current.shown
          ? { route: routeKey, shown: true, arrival }
          : current
      );
    };
    if (!flight.current) {
      // A full page load enters as the loading screen lifts
      return whenBooted(() => show());
    }
    // On approach the flight still says how it came: round in an
    // about-turn, or straight ahead
    const arrive = () => {
      const { active, turn } = worldStore.flight;
      show(active && turn ? swingIn(Math.sign(turn)) : rushIn);
    };
    const stop = onFlight((event, to) => {
      if (to === next && event !== 'start') arrive();
    });
    // The camera plans its flight on its next frame: none on its way here
    // by the frame after, and it is already here (a page opened from the
    // tour at the stop's own view sets off no flight), or one already on
    // approach, and there is nothing to wait for (World's 'returning' looks
    // the same way)
    let frames = 0;
    let frame = 0;
    const look = () => {
      if (++frames < 3) {
        frame = requestAnimationFrame(look);
        return;
      }
      const { active, to, approached } = worldStore.flight;
      if (!active || to !== next) show();
      else if (approached) arrive();
    };
    frame = requestAnimationFrame(look);
    const timer = window.setTimeout(() => show(), maxHold);
    return () => {
      stop();
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [routeKey, pathname, reduceMotion]);

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
      {/* Whatever the arrival, it ends at transform: none and filter: none
          (the perspective is dropped once it has played): either would make
          the wrapper the containing block of the page's fixed elements */}
      <m.div
        key={routeKey}
        initial="hidden"
        animate={shown ? 'visible' : 'hidden'}
        custom={shownRoute.arrival}
        variants={{
          hidden: {
            opacity: 0,
            y: reduceMotion ? 0 : 28,
            filter: 'blur(14px)',
            transformPerspective: 1400,
          },
          visible: (arrival: Arrival | null) => ({
            opacity: 1,
            ...(arrival && !reduceMotion
              ? {
                  x: [arrival.x, '0vw'],
                  y: [arrival.y, 0],
                  scale: [arrival.scale, 1],
                  rotateY: [arrival.rotateY, 0],
                }
              : { y: 0 }),
            filter: 'blur(0px)',
            transitionEnd: { filter: 'none', transformPerspective: 0 },
            transition: reveal,
          }),
        }}
        style={{ overflow: 'clip' }}
      >
        {children}
      </m.div>
    </>
  );
}
