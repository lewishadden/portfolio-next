'use client';

import { useEffect } from 'react';
import { useLenis } from 'lenis/react';

import type Lenis from 'lenis';

/*
 * Lenis's stop() and start() don't count: one start() undoes every earlier
 * stop(). Overlays that each stopped and restarted it themselves let the
 * page scroll under one another: closing the command palette over the open
 * mobile menu (or the loading screen) restarted Lenis while the menu still
 * needed the page held. Holders here share one hold, and Lenis restarts
 * only when the last lets go, and only if it was running when the first
 * took hold (the project modal's scroll lock stops it on its own).
 */
const holders = new Set<symbol>();
let resume = false;

function hold(lenis: Lenis) {
  const key = Symbol('lenis-hold');
  if (!holders.size) resume = !lenis.isStopped;
  holders.add(key);
  lenis.stop();
  return () => {
    holders.delete(key);
    if (!holders.size && resume) lenis.start();
  };
}

/** Holds the page still (stops Lenis) while `active`, alongside any other holder */
export function useLenisHold(active: boolean) {
  const lenis = useLenis();
  useEffect(() => {
    if (!active || !lenis) return;
    return hold(lenis);
  }, [active, lenis]);
}
