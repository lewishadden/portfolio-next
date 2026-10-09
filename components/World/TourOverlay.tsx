'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';

import { stationNames, stationPaths } from './routes';
import { navigateFromMode, tourStops, useWorldMode, worldMode } from './worldMode';
import { onFlight } from './worldStore';

import type { WorldContent } from './types';

/** How long the tour lingers at each stop once the camera has arrived */
const dwell = 6500;
/** Arrive anyway if no flight reports in (already there, or reduced motion) */
const arrivalFallback = 5000;

/**
 * The guided tour: the camera flies station to station on its own while a
 * caption card tells the story. Next skips ahead, Visit jumps to that
 * station's page, Escape (or Exit) ends it and returns to the page.
 */
export function TourOverlay({ captions }: { captions: WorldContent['tour'] }) {
  const { mode, tourStop } = useWorldMode();
  const touring = mode === 'tour';
  const station = tourStops[tourStop];
  const caption = captions.find((c) => c.station === station);
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const arrived = arrivedAt === `${tourStop}`;

  // Wait for the camera to land, linger, then move on. The countdown holds
  // while the pointer is over the card or a control in it has keyboard
  // focus, so nobody loses the stop they are reading (WCAG 2.2.2).
  useEffect(() => {
    if (!touring) return;
    const panel = panelRef.current;
    let fallback = 0;
    let advance = 0;
    let check = 0;
    // Time left at this stop; -1 until the camera has arrived
    let remaining = -1;
    let startedAt = 0;
    const isHeld = () => {
      if (!panel) return false;
      const focused = document.activeElement;
      return (
        panel.matches(':hover') ||
        (focused !== panel && panel.contains(focused) && !!focused?.matches(':focus-visible'))
      );
    };
    let held = isHeld();

    const run = () => {
      if (remaining < 0 || held) return;
      startedAt = performance.now();
      advance = window.setTimeout(() => worldMode.advanceTour(), remaining);
    };
    const hold = () => {
      held = true;
      if (!advance) return;
      window.clearTimeout(advance);
      advance = 0;
      remaining = Math.max(0, remaining - (performance.now() - startedAt));
    };
    // Focus moves after focusout fires, so look once things have settled
    const update = () => {
      window.clearTimeout(check);
      check = window.setTimeout(() => {
        if (isHeld()) {
          if (!held) hold();
        } else if (held) {
          held = false;
          run();
        }
      }, 0);
    };
    const land = () => {
      window.clearTimeout(fallback);
      if (remaining >= 0) return;
      setArrivedAt(`${tourStop}`);
      remaining = dwell;
      run();
    };

    const stop = onFlight((event, to) => {
      if (event === 'end' && to === station) land();
    });
    fallback = window.setTimeout(land, arrivalFallback);
    const events = ['pointerenter', 'pointerleave', 'focusin', 'focusout'] as const;
    events.forEach((type) => panel?.addEventListener(type, update));
    return () => {
      stop();
      events.forEach((type) => panel?.removeEventListener(type, update));
      window.clearTimeout(fallback);
      window.clearTimeout(advance);
      window.clearTimeout(check);
    };
  }, [touring, tourStop, station]);

  useEffect(() => {
    if (!touring) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') worldMode.exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [touring]);

  if (!touring || !caption) return null;
  const names = stationNames[station];
  // Stays in the tour until the page has arrived, so the camera flies there
  // as one move and the page waits for it (World's 'returning')
  const visit = () => navigateFromMode(stationPaths[station]);

  return (
    <div
      ref={panelRef}
      className="tour glass"
      role="region"
      aria-label="Guided tour"
      aria-live="polite"
      tabIndex={-1}
    >
      <p className="tour__step">
        <span className="tour__dot" aria-hidden="true" />
        Guided tour · {String(tourStop + 1).padStart(2, '0')} /{' '}
        {String(tourStops.length).padStart(2, '0')}
      </p>
      <h2 className="tour__title">
        {caption.title} <span>· {names.page}</span>
      </h2>
      <p className="tour__text">{caption.text}</p>
      <span className="tour__bar" aria-hidden="true">
        <span
          key={arrivedAt ?? 'flying'}
          className={arrived ? 'tour__fill tour__fill--run' : 'tour__fill'}
        />
      </span>
      <div className="tour__actions">
        <button type="button" className="btn btn--primary tour__btn" onClick={visit}>
          <span>Visit {names.page}</span>
          <Icon icon="ph:arrow-right-bold" width={15} height={15} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn--ghost tour__btn" onClick={worldMode.advanceTour}>
          {tourStop < tourStops.length - 1 ? 'Next stop' : 'Finish'}
        </button>
        <button type="button" className="tour__exit" onClick={worldMode.exit}>
          Exit <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}
