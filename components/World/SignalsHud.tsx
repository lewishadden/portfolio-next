'use client';

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '@iconify/react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { stationForPath, stationPaths, stationPositions } from './routes';
import {
  allFound,
  contactName,
  currentScan,
  dismissFound,
  isFound,
  recentFound,
  reopenFound,
  requestScan,
  scanRecharge,
  scanSweep,
  signalAt,
  subscribeSignals,
  signalCount,
  signals,
  useDetector,
  useFoundSignals,
  useLatestSignal,
} from './signalStore';
import { worldMode } from './worldMode';
import {
  onAutopilot,
  onDock as onDockable,
  setAutopilot,
  worldScanEvent,
  worldStore,
} from './worldStore';

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

/** Keys that work the card (Shift for Shift+Tab, Esc to leave): any other flies on */
const cardKeys = new Set(['Enter', 'Tab', 'Shift', 'Escape', 'Meta', 'Control', 'Alt', 'CapsLock']);

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

/**
 * A dock is offered (the dock prompt shows, and Enter docks): near a
 * station with no course set. Either changing re-reads it
 */
const subscribeOffer = (listener: () => void) => {
  const stopDock = onDockable(listener);
  const stopCourse = onAutopilot(listener);
  return () => {
    stopDock();
    stopCourse();
  };
};
const readOffer = () => !!worldStore.dock && !worldStore.autopilot;
const noOffer = () => false;

/**
 * The control with keyboard focus that takes Enter itself (null for none):
 * the HUD's ↵ hints hide while it has focus, since Enter is its then. A
 * course or dock change removes HUD buttons, and only some browsers
 * (Chrome) report a focused one going, so it's read again once drawn
 */
const subscribeFocus = (listener: () => void) => {
  let frame = 0;
  const stopOffer = subscribeOffer(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(listener);
  });
  document.addEventListener('focusin', listener);
  document.addEventListener('focusout', listener);
  return () => {
    stopOffer();
    cancelAnimationFrame(frame);
    document.removeEventListener('focusin', listener);
    document.removeEventListener('focusout', listener);
  };
};
const readFocus = () =>
  document.activeElement instanceof Element ? document.activeElement.closest(enterTargets) : null;
const noFocus = () => null;

/** The focused control that takes Enter itself, null for none (as the HUD's Enter handlers test it) */
export function useEnterControl() {
  return useSyncExternalStore(subscribeFocus, readFocus, noFocus);
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

/* ----------------- Sonar scans ----------------- */

/** How long a scan's result stays up (ms) */
const scanResultTime = 6000;

/** Which way a point lies from the camera, in words: "above left", "ahead", "behind and below"… */
function bearing(x: number, y: number, z: number) {
  const { camera } = worldStore;
  const dx = x - camera.x;
  const dy = y - camera.y;
  const dz = z - camera.z;
  const { fx, fy, fz } = camera;
  // Right is forward × up; the camera's up is right × forward
  const rl = Math.hypot(fz, fx) || 1;
  const [rx, rz] = [-fz / rl, fx / rl];
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  const side = dx * rx + dz * rz;
  const up = dx * ux + dy * uy + dz * uz;
  const ahead = dx * fx + dy * fy + dz * fz;
  const length = Math.hypot(dx, dy, dz) || 1;
  const vertical = up > 0.35 * length ? 'above' : up < -0.35 * length ? 'below' : '';
  if (ahead > Math.abs(side) * 1.5 || ahead < -Math.abs(side)) {
    const way = ahead > 0 ? 'ahead' : 'behind';
    return vertical ? `${way} and ${vertical}` : way;
  }
  const way = side > 0 ? 'right' : 'left';
  return vertical ? `${vertical} ${way}` : way;
}

/** What the last scan found, for its status line */
function scanResult() {
  const contacts = currentScan()
    .hits.filter((id) => !isFound(id))
    .map((id) => signals.find((signal) => signal.id === id)!);
  if (!contacts.length) {
    return signals.every((signal) => isFound(signal.id))
      ? 'Scan: every signal is logged'
      : 'Scan: no contacts in range';
  }
  const { camera } = worldStore;
  const nearest = contacts
    .map((signal) => {
      const at = signalAt(signal);
      return { at, distance: Math.hypot(at.x - camera.x, at.y - camera.y, at.z - camera.z) };
    })
    .sort((a, b) => a.distance - b.distance)[0];
  const count = contacts.length === 1 ? '1 contact' : `${contacts.length} contacts`;
  const where = bearing(nearest.at.x, nearest.at.y, nearest.at.z);
  return `Scan: ${count} · nearest ${Math.round(nearest.distance)} km, ${where}`;
}

/** How long a "recharging" notice stays up (ms), and the longest a result waits on the sweep */
const noticeTime = 2500;
const sweepWait = scanSweep * 1000 + 2500;

/**
 * The sonar scan's status line. It hears every request for a scan (F in
 * free roam, which ExploreControls dispatches as worldScanEvent, or the
 * Scan button): says it is sweeping, then, once the canvas has swept out
 * to detector range (the scan's `swept`), what it found (how many contacts,
 * how far and which way the nearest is), or how long until the scanner
 * has recharged. Mounted for all of free roam, so the status region is
 * there before anything is said in it
 */
export function ScanStatus() {
  const [text, setText] = useState('');

  useEffect(() => {
    let clearTimer = 0;
    let stopWaiting = () => {};
    const say = (next: string, clearAfter = 0) => {
      window.clearTimeout(clearTimer);
      setText(next);
      if (clearAfter) clearTimer = window.setTimeout(() => setText(''), clearAfter);
    };
    const onScan = () => {
      if (worldMode.get().mode !== 'explore' || worldStore.docking) return;
      if (!requestScan()) {
        say(`Scanner recharging · ${Math.ceil(scanRecharge())} s`, noticeTime);
        return;
      }
      say('Scanning…');
      stopWaiting();
      const at = currentScan().at;
      const done = () => {
        stopWaiting();
        say(scanResult(), scanResultTime);
      };
      // The sweep is the canvas's: a slow frame rate mustn't report it early
      const unsubscribe = subscribeSignals(() => {
        const latest = currentScan();
        if (latest.at === at && latest.swept) done();
      });
      const fallback = window.setTimeout(done, sweepWait);
      stopWaiting = () => {
        unsubscribe();
        window.clearTimeout(fallback);
        stopWaiting = () => {};
      };
    };
    window.addEventListener(worldScanEvent, onScan);
    return () => {
      window.removeEventListener(worldScanEvent, onScan);
      window.clearTimeout(clearTimer);
      stopWaiting();
    };
  }, []);

  return (
    <p className="explore-hud__scan" role="status">
      {text}
    </p>
  );
}

/** Touch's way to scan (desktop presses F): over the rise and sink buttons */
export function ScanButton() {
  return (
    <button
      type="button"
      className="explore-hud__scan-button"
      onClick={() => window.dispatchEvent(new CustomEvent(worldScanEvent))}
    >
      <Icon icon="ph:broadcast-bold" width={18} height={18} aria-hidden="true" />
      <span>Scan</span>
    </button>
  );
}

/** What the HUD calls a signal: its name once found, its scan's letter before (Signal A…) */
export function signalName(id: (typeof signals)[number]['id']) {
  return isFound(id) ? signals.find((signal) => signal.id === id)!.name : contactName(id);
}

/** Enter reaches the card's choices (shown while focus is elsewhere and no dock is offered) */
const enterHint = <kbd aria-hidden="true">↵</kbd>;

function ActionButton({
  action,
  cv,
  onCourse,
  onUsed,
  hint,
}: {
  action: SignalAction;
  cv: WorldContent['cv'];
  onCourse: (path: string, from: HTMLElement) => void;
  onUsed: (from: HTMLElement) => void;
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
    <a className="btn btn--primary" {...link} onClick={(e) => onUsed(e.currentTarget)}>
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
 * closed. The card stays up while focus is in it, until the ship flies on
 * or a dock is offered: focus then goes back to the HUD (where Enter
 * docks) and the card closes itself again. Any choice used closes it
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
  // Enter docks while a dock is offered, and is a focused control's own
  // (a station marker, Exit, one of the card's choices), so no ↵ then
  const dockOffered = useSyncExternalStore(subscribeOffer, readOffer, noOffer);
  const control = useEnterControl();

  useEffect(() => {
    if (!latest || held) return;
    const id = window.setTimeout(dismissFound, cardTime);
    return () => window.clearTimeout(id);
  }, [latest, held]);

  /** Keyboard focus leaves the card for the HUD, and its timer runs again */
  const handBack = useEffectEvent(() => {
    const card = cardRef.current;
    if (!card?.contains(document.activeElement)) return;
    card.closest<HTMLElement>('.explore-hud')?.focus({ preventScroll: true });
    setFocusedOn('');
  });

  // Flying on hands focus back: with the mouse locked nothing else moves it,
  // so a card Enter brought focus to would stay up for good
  useEffect(() => {
    if (!held) return;
    const onKey = (e: KeyboardEvent) => {
      if (cardKeys.has(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
      handBack();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [held]);

  // So does a dock being offered: Enter is the dock prompt's then, as its ↵
  // says, never the focused choice's (a download, a link, a course away)
  useEffect(
    () =>
      subscribeOffer(() => {
        if (readOffer() && !worldStore.docking) handBack();
      }),
    []
  );

  // Enter, with no control focused and no dock offered (the dock prompt has
  // it then), goes to the last find's card: open again if it has closed,
  // its first choice focused, so a second Enter takes it. Capture phase,
  // ahead of the HUD's dock shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.defaultPrevented) return;
      if (worldMode.get().mode !== 'explore' || worldStore.docking) return;
      if (e.target instanceof Element && e.target.closest(enterTargets)) return;
      if (readOffer() || !recentFound()) return;
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

  // A download or link used closes it too, once the browser has followed it
  const used = (from: HTMLElement) => window.setTimeout(() => close(from));

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
  const hint = !touch && !control && !dockOffered;
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
            onUsed={used}
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
