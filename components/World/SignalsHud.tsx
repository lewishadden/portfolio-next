'use client';

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '@iconify/react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { stationForPath, stationPaths, stationPositions } from './routes';
import {
  allFound,
  dismissFound,
  recentFound,
  reopenFound,
  signalCount,
  signals,
  useDetector,
  useFoundSignals,
  useLatestSignal,
} from './signalStore';
import { worldMode } from './worldMode';
import { onAutopilot, setAutopilot, worldStore } from './worldStore';

import type { StationKey } from './routes';
import type { SignalAction } from './signalStore';
import type { WorldContent } from './types';

/** How long a find's card stays up (the mouse may be locked, so it closes itself) */
const cardTime = 16_000;

/** Controls that act on Enter themselves */
const enterTargets =
  'button, a[href], input, textarea, select, [role="button"], [contenteditable]:not([contenteditable="false"])';

/** The card's choices, in order: what it carries first, Close last */
const cardActions = '.explore-hud__signal-actions :is(a[href], button)';

/* ----------------- A signal's page action: course set, docking on arrival ----------------- */

/**
 * Where the autopilot parks in front of a station (ExploreControls'
 * `approach`), and how close to it and how slow the ship has to be for a
 * course handed back there to count as arrived rather than taken over
 */
const parking = { x: 0, y: 1.5, z: 16, near: 4, slow: 5 };

/** The station a signal's page action set course for: the ship docks there on arrival ('' for none) */
let dockOnArrival: StationKey | '' = '';
const arrivalListeners = new Set<() => void>();

function setDockOnArrival(station: StationKey | '') {
  if (dockOnArrival === station) return;
  dockOnArrival = station;
  arrivalListeners.forEach((listener) => listener());
}

const subscribeArrival = (listener: () => void) => {
  arrivalListeners.add(listener);
  return () => {
    arrivalListeners.delete(listener);
  };
};
const readArrival = () => dockOnArrival;
const noArrival = (): StationKey | '' => '';

/** The station the autopilot is taking the ship to dock at, '' for an ordinary course */
export function useDockOnArrival() {
  return useSyncExternalStore(subscribeArrival, readArrival, noArrival);
}

/** The ship is parked where the autopilot leaves it in front of `station` */
function parkedAt(station: StationKey) {
  const [x, y, z] = stationPositions[station];
  const { camera } = worldStore;
  const off = Math.hypot(
    camera.x - x - parking.x,
    camera.y - y - parking.y,
    camera.z - z - parking.z
  );
  return off < parking.near && worldStore.velocity < parking.slow;
}

/** Free roam's tally of signals found, for the HUD's top bar */
export function SignalCount() {
  const found = useFoundSignals().length;
  return (
    <span
      className={`explore-hud__signals${found === signalCount ? ' explore-hud__signals--all' : ''}`}
      title="Hidden signals found"
    >
      <Icon icon="ph:broadcast-bold" width={15} height={15} aria-hidden="true" />
      <span aria-hidden="true">
        {found}/{signalCount}
      </span>
      <span className="sr-only">
        {found} of {signalCount} hidden signals found
      </span>
    </span>
  );
}

/** Warms up as you near a signal you haven't found: hot and cold, no direction */
export function SignalDetector() {
  const bars = useDetector();
  if (!bars) return null;
  return (
    <div className="explore-hud__detector" aria-hidden="true">
      <span className="explore-hud__detector-label">
        {bars >= 4 ? 'Strong signal' : 'Signal detected'}
      </span>
      <span className="explore-hud__detector-bars">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < bars ? 'is-on' : undefined} />
        ))}
      </span>
    </div>
  );
}

/** Enter reaches the card's choices (shown while keyboard focus is elsewhere) */
const enterHint = <kbd aria-hidden="true">↵</kbd>;

function ActionButton({
  action,
  cv,
  onCourse,
  hint,
}: {
  action: SignalAction;
  cv: WorldContent['cv'];
  onCourse: (path: string, from: HTMLElement) => void;
  hint: boolean;
}) {
  const icon = action.kind === 'cv' ? 'ph:file-arrow-down-bold' : 'ph:arrow-up-right-bold';
  if (action.kind === 'page') {
    return (
      <button
        type="button"
        className="btn btn--primary"
        onClick={(e) => onCourse(action.href, e.currentTarget)}
      >
        <span>{action.label}</span>
        <Icon icon={icon} width={15} height={15} aria-hidden="true" />
        {hint && enterHint}
      </button>
    );
  }
  const link =
    action.kind === 'cv'
      ? { href: cv.url, download: cv.name }
      : { href: action.href, target: '_blank', rel: 'noopener noreferrer' };
  return (
    <a className="btn btn--primary" {...link}>
      <span>{action.label}</span>
      <Icon icon={icon} width={15} height={15} aria-hidden="true" />
      {action.kind === 'link' && <span className="sr-only"> (opens in a new tab)</span>}
      {hint && enterHint}
    </a>
  );
}

/**
 * What a signal says when you find it, with what it carries. A page it
 * offers (the derelict's "Report it", "Say hello" once all are found) isn't
 * opened from wherever the ship is: the autopilot sets course for that
 * page's station, and the ship docks (`onDock`, the docking sequence) once
 * it has parked there. Taking the controls back on the way cancels it.
 * Enter (on no control, and with no dock offered) brings keyboard focus to
 * the card's first choice, opening the last find's card again if it has
 * closed; the card stays up while focus is in it
 */
export function SignalCard({
  cv,
  onDock,
}: {
  cv: WorldContent['cv'];
  onDock: (path: string) => void;
}) {
  const latest = useLatestSignal();
  const found = useFoundSignals().length;
  const signal = signals.find((s) => s.id === latest);
  const touch = useMediaQuery('(pointer: coarse)');
  const cardRef = useRef<HTMLDivElement>(null);
  // The find whose card has keyboard focus in it ('' for none): it stays up
  const [focusedOn, setFocusedOn] = useState('');
  const held = !!latest && focusedOn === latest;

  useEffect(() => {
    if (!latest || held) return;
    const id = window.setTimeout(dismissFound, cardTime);
    return () => window.clearTimeout(id);
  }, [latest, held]);

  // Enter, with no control focused and no dock offered (the dock prompt has
  // it then), goes to the last find's card: open again if it has closed,
  // its first choice focused, so a second Enter takes it. Capture phase,
  // ahead of the HUD's dock shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.defaultPrevented) return;
      if (worldMode.get().mode !== 'explore' || worldStore.docking) return;
      if (e.target instanceof Element && e.target.closest(enterTargets)) return;
      if ((worldStore.dock && !worldStore.autopilot) || !recentFound()) return;
      e.preventDefault();
      reopenFound();
      requestAnimationFrame(() =>
        cardRef.current?.querySelector<HTMLElement>(cardActions)?.focus({ preventScroll: true })
      );
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // The course a page action set: docks once the autopilot hands back the
  // controls parked in front of the station, and is forgotten if they were
  // taken back on the way, another course was set or free roam ended
  const dock = useEffectEvent((station: StationKey) => onDock(stationPaths[station]));
  useEffect(() => {
    const stop = onAutopilot(() => {
      const station = dockOnArrival;
      if (!station || worldStore.autopilot === station) return;
      setDockOnArrival('');
      const arrived =
        !worldStore.autopilot && worldMode.get().mode === 'explore' && parkedAt(station);
      if (arrived) dock(station);
    });
    return () => {
      stop();
      setDockOnArrival('');
    };
  }, []);

  /** The card goes: keyboard focus goes back to the HUD (where Enter docks) */
  const close = (from: HTMLElement) => {
    from.closest<HTMLElement>('.explore-hud')?.focus({ preventScroll: true });
    setFocusedOn('');
    dismissFound();
  };

  const setCourse = (path: string, from: HTMLElement) => {
    const station = stationForPath(path);
    close(from);
    // Set course first: the autopilot's change would otherwise end the docking course at once
    setAutopilot(station);
    setDockOnArrival(station);
  };

  if (!signal) return null;
  const complete = found === signalCount;
  const actions = [
    signal.action,
    complete && signal.action?.kind !== 'page' ? allFound.action : undefined,
  ].filter((action): action is SignalAction => !!action);
  const hint = !touch && !held;
  return (
    <div
      ref={cardRef}
      className="explore-hud__signal glass"
      role="status"
      onFocus={() => setFocusedOn(latest)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusedOn('');
      }}
    >
      <p className="explore-hud__signal-eyebrow">
        <Icon icon="ph:broadcast-bold" width={14} height={14} aria-hidden="true" />
        Signal found · {found}/{signalCount}
      </p>
      <h2 className="explore-hud__signal-title">{signal.name}</h2>
      <p className="explore-hud__signal-text">{signal.message}</p>
      {complete && (
        <p className="explore-hud__signal-text explore-hud__signal-text--all">
          <b>{allFound.name}.</b> {allFound.message}
        </p>
      )}
      <div className="explore-hud__signal-actions">
        {actions.map((action, i) => (
          <ActionButton
            key={action.label}
            action={action}
            cv={cv}
            onCourse={setCourse}
            hint={hint && i === 0}
          />
        ))}
        <button type="button" className="explore-hud__exit" onClick={(e) => close(e.currentTarget)}>
          Close
          {hint && !actions.length && enterHint}
        </button>
      </div>
    </div>
  );
}
