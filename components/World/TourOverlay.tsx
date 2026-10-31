'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { usePathname } from 'next/navigation';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { motionLevel } from '@/utils/motion';

import { stationForPath, stationNames, stationPaths } from './routes';
import { launchWorldMode, navigateFromMode, tourStops, useWorldMode, worldMode } from './worldMode';
import { onFlight, showcase, worldStore } from './worldStore';

import type { CSSProperties } from 'react';
import type { WorldContent } from './types';

/**
 * How long the tour lingers at a stop once the camera has arrived: time to
 * read its caption, within bounds (ms)
 */
const dwellFor = (text: string) => Math.min(10000, Math.max(5500, 3500 + 45 * text.length));
/**
 * When to look for an arrival that never reported in (ms), and how often
 * after that while a flight here is still getting on: about-turns take up
 * to 7.8s, and longer when frames drop
 */
const arrivalFallback = 5000;
const arrivalRecheck = 500;
/** The station shows off (its trick) this long after the camera lands (ms) */
const showcaseDelay = 600;

/** A touch screen taps where a mouse clicks or hovers */
const pointerVerbs = /\b(click|hover)(s|ed|ing)?\b/gi;
const tapping: Record<string, string> = { '': 'tap', s: 'taps', ed: 'tapped', ing: 'tapping' };
function forTouch(text: string) {
  return text.replace(pointerVerbs, (word: string, _verb: string, ending = '') => {
    const tap = tapping[ending.toLowerCase()] ?? 'tap';
    return word[0] === word[0].toUpperCase() ? tap[0].toUpperCase() + tap.slice(1) : tap;
  });
}

/** Arrow keys, Space and Escape belong to these (a field, the command palette), not the tour */
const ownKeys = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest('input, textarea, select, [contenteditable], [role="dialog"]');

/**
 * The guided tour: the camera flies station to station on its own, starting
 * from where it is, while a caption card tells the story. Next / → and
 * Previous / ← step through the stops, Pause (or Space on the card) holds
 * the countdown, Visit opens that station's page, Escape (or Exit) ends it
 * and returns to the page. After the last stop a closing card offers the
 * contact page, free roam from there, or the way back.
 */
export function TourOverlay({ captions }: { captions: WorldContent['tour'] }) {
  const { mode, tourStop, tourStep } = useWorldMode();
  const pathname = usePathname();
  const touch = useMediaQuery('(hover: none), (pointer: coarse)');
  const touring = mode === 'tour';
  const finale = tourStep >= tourStops.length;
  const station = tourStops[tourStop];
  const caption = captions.find((c) => c.station === station);
  const dwell = dwellFor(caption?.text ?? '');
  const [landedAt, setLandedAt] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  // A new tour starts afresh: not landed, not paused
  if (!touring && (landedAt !== null || paused)) {
    setLandedAt(null);
    setPaused(false);
  }
  // Every step waits for its own landing, even back at a stop that had
  // landed before (a quick → then ←): the bar fills only once the camera is in
  const [stepSeen, setStepSeen] = useState(tourStep);
  if (stepSeen !== tourStep) {
    setStepSeen(tourStep);
    setLandedAt(null);
  }
  const panelRef = useRef<HTMLDivElement>(null);
  const landed = landedAt === `${tourStep}`;

  // Wait for the camera to land, linger, then move on. The countdown holds
  // while the tour is paused, the pointer is over the card or a control in
  // it has keyboard focus, so nobody loses the stop they are reading
  // (WCAG 2.2.2). The closing card stays until the visitor chooses.
  useEffect(() => {
    if (!touring || finale) return;
    const panel = panelRef.current;
    let fallback = 0;
    let advance = 0;
    let check = 0;
    let frame = 0;
    let trick = 0;
    // Time left at this stop; -1 until the camera has arrived
    let remaining = -1;
    let startedAt = 0;
    const isHeld = () => {
      if (!panel) return false;
      const focused = document.activeElement;
      return (
        panel.hasAttribute('data-paused') ||
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
      cancelAnimationFrame(frame);
      if (remaining >= 0) return;
      setLandedAt(`${tourStep}`);
      remaining = dwell;
      run();
      // The station greets the camera with its trick; only at full motion
      if (motionLevel() === 'full') {
        trick = window.setTimeout(() => showcase(station, 'tour'), showcaseDelay);
      }
    };

    const stop = onFlight((event, to) => {
      if (event === 'end' && to === station) land();
    });
    if (motionLevel() === 'full') {
      // The camera plans its flight on its next frame: none on its way here
      // by the frame after, and it is already here (a step back from the
      // closing card, or the tour starting where the camera was)
      let frames = 0;
      const look = () => {
        if (++frames < 3) frame = requestAnimationFrame(look);
        else if (!(worldStore.flight.active && worldStore.flight.to === station)) land();
      };
      frame = requestAnimationFrame(look);
      // Arrive anyway if the flight's 'end' never comes, but not while the
      // flight here is still moving (a stale one, its progress stuck, isn't)
      let seen = -1;
      const recheck = () => {
        const { active, to, progress } = worldStore.flight;
        if (active && to === station && progress !== seen) {
          seen = progress;
          fallback = window.setTimeout(recheck, arrivalRecheck);
        } else land();
      };
      fallback = window.setTimeout(recheck, arrivalFallback);
    } else {
      // Below full motion the camera cuts to each stop: it is there already
      fallback = window.setTimeout(land, 0);
    }
    const events = ['pointerenter', 'pointerleave', 'focusin', 'focusout'] as const;
    events.forEach((type) => panel?.addEventListener(type, update));
    const pausing = new MutationObserver(update);
    if (panel) pausing.observe(panel, { attributeFilter: ['data-paused'] });
    return () => {
      stop();
      events.forEach((type) => panel?.removeEventListener(type, update));
      pausing.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
      window.clearTimeout(advance);
      window.clearTimeout(check);
      window.clearTimeout(trick);
    };
  }, [touring, finale, tourStep, station, dwell]);

  // Keys: Escape ends the tour, ← / → step through it, Space on a stop's
  // card pauses (the closing card has no countdown, nor a pause to show).
  // An Escape something else has claimed (closing the command palette over
  // the tour) or pressed in a field or dialog is left to it
  useEffect(() => {
    if (!touring) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!e.defaultPrevented && !ownKeys(e.target)) worldMode.exit();
        return;
      }
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || ownKeys(e.target)) return;
      const onStop = worldMode.get().tourStep < tourStops.length;
      if (e.key === 'ArrowRight') worldMode.advanceTour();
      else if (e.key === 'ArrowLeft') worldMode.backTour();
      else if (e.key === ' ' && e.target === panelRef.current && onStop) setPaused((on) => !on);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [touring]);

  // The card takes focus as the tour starts, and back whenever the control
  // that had it goes (the closing card's buttons replace the stop's)
  useEffect(() => {
    const panel = panelRef.current;
    if (touring && panel && !panel.contains(document.activeElement)) {
      panel.focus({ preventScroll: true });
    }
  }, [touring, finale]);

  if (!touring || (!finale && !caption)) return null;
  const here = stationForPath(pathname);

  if (finale) {
    return (
      <div
        ref={panelRef}
        className="tour glass"
        role="region"
        aria-label="Guided tour"
        aria-live="polite"
        tabIndex={-1}
        // On a short screen the card can scroll (World.scss)
        data-lenis-prevent
      >
        <p className="tour__step">
          <span className="tour__dot" aria-hidden="true" />
          Guided tour · Complete
        </p>
        <h2 className="tour__title">That was the tour</h2>
        <p className="tour__text">
          Six stations, one career. Say hello, take the controls and fly the world yourself, or head
          back to {stationNames[here].page}.
        </p>
        <div className="tour__actions">
          {here !== 'contact' && (
            <button
              type="button"
              className="btn btn--primary tour__btn"
              onClick={() => navigateFromMode(stationPaths.contact)}
            >
              <span>Open Contact</span>
              <Icon icon="ph:arrow-right-bold" width={15} height={15} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost tour__btn"
            onClick={() => launchWorldMode('explore', () => undefined)}
          >
            <Icon icon="ph:rocket-launch-bold" width={15} height={15} aria-hidden="true" />
            Fly freely from here
          </button>
          <button type="button" className="tour__exit" onClick={worldMode.exit}>
            Back to {stationNames[here].page} {!touch && <kbd>Esc</kbd>}
          </button>
        </div>
      </div>
    );
  }

  const names = stationNames[station];
  const first = tourStep === 0;

  return (
    <div
      ref={panelRef}
      className="tour glass"
      role="region"
      aria-label="Guided tour"
      aria-live="polite"
      tabIndex={-1}
      data-lenis-prevent
      data-paused={paused || undefined}
      style={{ '--tour-dwell': `${dwell}ms` } as CSSProperties}
    >
      <p className="tour__step">
        <span className="tour__dot" aria-hidden="true" />
        Guided tour · {String(tourStep + 1).padStart(2, '0')} /{' '}
        {String(tourStops.length).padStart(2, '0')}
        {/* Said aloud (the card is a live region) when Space pauses it */}
        {paused && ' · Paused'}
      </p>
      <h2 className="tour__title">
        {caption!.title} <span>· {names.page}</span>
      </h2>
      <p className="tour__text">{touch ? forTouch(caption!.text) : caption!.text}</p>
      <span className="tour__bar" aria-hidden="true">
        <span
          key={landedAt ?? 'flying'}
          className={landed ? 'tour__fill tour__fill--run' : 'tour__fill'}
        />
      </span>
      <div className="tour__actions">
        <button
          type="button"
          className="btn btn--primary tour__btn"
          onClick={() => navigateFromMode(stationPaths[station])}
        >
          <span>Visit {names.page}</span>
          <Icon icon="ph:arrow-right-bold" width={15} height={15} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn--ghost tour__btn" onClick={worldMode.advanceTour}>
          {tourStep < tourStops.length - 1 ? 'Next stop' : 'Finish'}
        </button>
        <span className="tour__controls">
          <button
            type="button"
            className="tour__icon"
            aria-label="Previous stop"
            aria-disabled={first || undefined}
            onClick={worldMode.backTour}
          >
            <Icon icon="ph:caret-left-bold" width={16} height={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tour__icon"
            aria-label="Pause the tour"
            aria-pressed={paused}
            onClick={() => setPaused((on) => !on)}
          >
            <Icon
              icon={paused ? 'ph:play-bold' : 'ph:pause-bold'}
              width={16}
              height={16}
              aria-hidden="true"
            />
          </button>
        </span>
        <button type="button" className="tour__exit" onClick={worldMode.exit}>
          Exit {!touch && <kbd>Esc</kbd>}
        </button>
      </div>
    </div>
  );
}
