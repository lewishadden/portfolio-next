'use client';

import { useEffect, useEffectEvent, useSyncExternalStore } from 'react';
import { Icon } from '@iconify/react';

import { stationForPath, stationPaths, stationPositions } from './routes';
import {
  allFound,
  dismissFound,
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

function ActionButton({
  action,
  cv,
  onCourse,
}: {
  action: SignalAction;
  cv: WorldContent['cv'];
  onCourse: (path: string, from: HTMLElement) => void;
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
    </a>
  );
}

/**
 * What a signal says when you find it, with what it carries. A page it
 * offers (the derelict's "Report it", "Say hello" once all are found) isn't
 * opened from wherever the ship is: the autopilot sets course for that
 * page's station, and the ship docks (`onDock`, the docking sequence) once
 * it has parked there. Taking the controls back on the way cancels it
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

  useEffect(() => {
    if (!latest) return;
    const id = window.setTimeout(dismissFound, cardTime);
    return () => window.clearTimeout(id);
  }, [latest]);

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

  const setCourse = (path: string, from: HTMLElement) => {
    const station = stationForPath(path);
    // The card goes: keyboard focus goes back to the HUD (where Enter docks)
    from.closest<HTMLElement>('.explore-hud')?.focus({ preventScroll: true });
    dismissFound();
    // Set course first: the autopilot's change would otherwise end the docking course at once
    setAutopilot(station);
    setDockOnArrival(station);
  };

  if (!signal) return null;
  const complete = found === signalCount;
  return (
    <div className="explore-hud__signal glass" role="status">
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
        {signal.action && <ActionButton action={signal.action} cv={cv} onCourse={setCourse} />}
        {complete && allFound.action && signal.action?.kind !== 'page' && (
          <ActionButton action={allFound.action} cv={cv} onCourse={setCourse} />
        )}
        <button type="button" className="explore-hud__exit" onClick={dismissFound}>
          Close
        </button>
      </div>
    </div>
  );
}
