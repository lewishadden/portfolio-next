'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { Icon } from '@iconify/react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { canLockPointer, usePointerLocked } from './pointerLock';
import { stationForPath, stationNames, stationPaths } from './routes';
import { SignalCard, SignalCount, SignalDetector } from './SignalsHud';
import { useAutopilot, Waypoints } from './Waypoints';
import { useWorldMode, worldMode } from './worldMode';
import { exploreInput, onDock, onDocking, setAutopilot, worldStore } from './worldStore';

import type { StationKey } from './routes';
import type { WorldContent } from './types';

const noDock = () => '';
const readDock = () => worldStore.dock;

/** How far (px) a thumbstick's knob travels from where the thumb landed */
const stickReach = 56;
/** The move stick boosts with the thumb pushed on past its rim, this many reaches out */
const boostAt = 1.8;
/** How far the look stick has to be pushed to take the controls back from the autopilot */
const lookTakeOver = 0.35;
/** Where the sticks wait, in from the bottom corners (px) */
const restInset = { x: 96, y: 112 };
/** A touch this short (ms) and still (px) is a tap, passed on to the station marker under it */
const tap = { time: 300, slop: 10 };

interface Stick {
  el: HTMLElement;
  /** The pointer holding it, -1 when free */
  id: number;
  /** Its centre: where the thumb landed, or its corner at rest */
  x: number;
  y: number;
  /** When the thumb landed, and the furthest it has moved since (px) */
  downAt: number;
  travel: number;
}

/** Taps the station marker at a point (it sets the autopilot), if there is one */
function tapMarker(x: number, y: number) {
  for (const el of document.elementsFromPoint(x, y)) {
    const marker = el.closest<HTMLElement>('.waypoint');
    if (marker) {
      marker.click();
      return;
    }
  }
}

/**
 * Twin thumbsticks for touch, as in mobile games. A thumb landing anywhere on
 * the left half of the screen gets a move stick under it (forward and back,
 * strafe; pushed on out to the dashed boost ring, boost: a ring follows the
 * thumb out from the rim, so you can see how far is left), and one on the
 * right half a look stick: held off-centre, the view keeps turning that way,
 * faster the further out.
 * At rest each waits, faint, in its corner. The layer takes every touch with
 * `touch-action: none`, so the browser never claims a drag as a scroll and
 * cancels it. It lies over the station markers, which drift into the thumbs'
 * corners, so a thumb landing on one still gets its stick; a quick tap is
 * passed on to the marker. The rest of the HUD sits above it.
 */
function TouchSticks() {
  const layerRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef<HTMLSpanElement>(null);
  const lookRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !moveRef.current || !lookRef.current) return;
    const move: Stick = { el: moveRef.current, id: -1, x: 0, y: 0, downAt: 0, travel: 0 };
    const look: Stick = { el: lookRef.current, id: -1, x: 0, y: 0, downAt: 0, travel: 0 };
    const sticks = [move, look];

    const place = (stick: Stick, x: number, y: number) => {
      stick.x = x;
      stick.y = y;
      stick.el.style.setProperty('--x', `${x}px`);
      stick.el.style.setProperty('--y', `${y}px`);
    };
    const tilt = (stick: Stick, dx: number, dy: number) => {
      stick.el.style.setProperty('--kx', `${dx * stickReach}px`);
      stick.el.style.setProperty('--ky', `${dy * stickReach}px`);
    };
    const rest = () => {
      const y = layer.clientHeight - restInset.y;
      if (move.id < 0) place(move, restInset.x, y);
      if (look.id < 0) place(look, layer.clientWidth - restInset.x, y);
    };
    const steer = (stick: Stick, e: PointerEvent) => {
      let dx = (e.clientX - stick.x) / stickReach;
      let dy = (e.clientY - stick.y) / stickReach;
      const length = Math.hypot(dx, dy);
      stick.travel = Math.max(stick.travel, length * stickReach);
      if (length > 1) {
        dx /= length;
        dy /= length;
      }
      tilt(stick, dx, dy);
      if (stick === move) {
        const boost = length >= boostAt;
        // A ring follows the thumb out from the rim to the boost ring
        stick.el.style.setProperty('--thumb', `${Math.min(length, boostAt) * stickReach * 2}px`);
        stick.el.style.setProperty(
          '--charge',
          Math.min(Math.max((length - 1) / (boostAt - 1), 0), 1).toFixed(3)
        );
        exploreInput.strafe = dx;
        exploreInput.forward = -dy;
        exploreInput.boost = boost;
        stick.el.toggleAttribute('data-boost', boost);
      } else {
        exploreInput.stickX = dx;
        exploreInput.stickY = dy;
        if (worldStore.autopilot && length > lookTakeOver) setAutopilot('');
      }
    };
    const release = (stick: Stick) => {
      stick.id = -1;
      stick.el.removeAttribute('data-active');
      stick.el.removeAttribute('data-boost');
      tilt(stick, 0, 0);
      if (stick === move) {
        stick.el.style.setProperty('--charge', '0');
        exploreInput.strafe = 0;
        exploreInput.forward = 0;
        exploreInput.boost = false;
      } else {
        exploreInput.stickX = 0;
        exploreInput.stickY = 0;
      }
      rest();
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const stick = e.clientX < layer.clientWidth / 2 ? move : look;
      if (stick.id >= 0) return;
      e.preventDefault();
      stick.id = e.pointerId;
      stick.downAt = e.timeStamp;
      stick.travel = 0;
      layer.setPointerCapture(e.pointerId);
      stick.el.setAttribute('data-active', '');
      place(stick, e.clientX, e.clientY);
      tilt(stick, 0, 0);
    };
    const drag = (e: PointerEvent) => {
      const stick = sticks.find((s) => s.id === e.pointerId);
      if (stick) steer(stick, e);
    };
    const up = (e: PointerEvent) => {
      const stick = sticks.find((s) => s.id === e.pointerId);
      if (!stick) return;
      const tapped =
        e.type === 'pointerup' && e.timeStamp - stick.downAt < tap.time && stick.travel < tap.slop;
      release(stick);
      if (tapped) tapMarker(e.clientX, e.clientY);
    };

    move.el.style.setProperty('--boost-d', `${boostAt * stickReach * 2}px`);
    rest();
    layer.addEventListener('pointerdown', down);
    layer.addEventListener('pointermove', drag);
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', up);
    window.addEventListener('resize', rest);
    return () => {
      layer.removeEventListener('pointerdown', down);
      layer.removeEventListener('pointermove', drag);
      layer.removeEventListener('pointerup', up);
      layer.removeEventListener('pointercancel', up);
      window.removeEventListener('resize', rest);
      sticks.forEach(release);
    };
  }, []);

  const hold = (lift: number) => ({
    onPointerDown: () => {
      exploreInput.lift = lift;
    },
    onPointerUp: () => {
      exploreInput.lift = 0;
    },
    onPointerCancel: () => {
      exploreInput.lift = 0;
    },
    onPointerLeave: () => {
      exploreInput.lift = 0;
    },
  });

  return (
    <>
      <div ref={layerRef} className="explore-hud__sticks">
        <span ref={moveRef} className="explore-hud__stick" data-label="Move" aria-hidden="true">
          <span className="explore-hud__stick-boost" />
          <span className="explore-hud__stick-charge" />
          <span className="explore-hud__stick-knob" />
        </span>
        <span ref={lookRef} className="explore-hud__stick" data-label="Look" aria-hidden="true">
          <span className="explore-hud__stick-knob" />
        </span>
      </div>
      <div className="explore-hud__lift">
        <button type="button" aria-label="Rise" {...hold(1)}>
          <Icon icon="ph:caret-up-bold" width={18} height={18} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Sink" {...hold(-1)}>
          <Icon icon="ph:caret-down-bold" width={18} height={18} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

/**
 * Boosting (Shift, or the move stick pushed out to its boost ring) while
 * thrusting: a rocket jet fires under the middle of the view, its flame
 * longer the faster you go. Read each frame, not rendered by React
 */
function BoostJet() {
  const ref = useRef<HTMLDivElement>(null);
  const gradient = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    let on = false;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const thrusting = exploreInput.forward || exploreInput.strafe || exploreInput.lift;
      const boosting =
        exploreInput.boost && !!thrusting && !worldStore.autopilot && !worldStore.docking;
      if (boosting !== on) {
        on = boosting;
        el.toggleAttribute('data-on', on);
      }
      if (on) el.style.setProperty('--thrust', Math.min(worldStore.velocity / 70, 1).toFixed(2));
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={ref} className="explore-hud__jet" aria-hidden="true">
      <svg className="explore-hud__rocket" viewBox="0 0 24 30" width="24" height="30">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--gradient-start)' }} />
            <stop offset="1" style={{ stopColor: 'var(--gradient-end)' }} />
          </linearGradient>
        </defs>
        <g fill={`url(#${gradient})`}>
          <path d="M12 1c4.2 3.6 6.3 8.6 6.3 14.6V24H5.7v-8.4C5.7 9.6 7.8 4.6 12 1Z" />
          <path d="M5.7 16.5 1.5 22v5l4.2-2.6ZM18.3 16.5l4.2 5.5v5l-4.2-2.6Z" />
          <path d="M8.6 24h6.8l-.9 3H9.5Z" />
        </g>
        <circle cx="12" cy="12" r="2.6" className="explore-hud__rocket-window" />
      </svg>
      <span className="explore-hud__flame" />
      <span className="explore-hud__jet-label">Boost</span>
    </div>
  );
}

const noLock = () => false;
const subscribeNothing = () => () => {};
const readDocking = () => worldStore.docking;

/**
 * Docking: clamps close in from the edges, a light sweeps the view and a
 * bar fills while the camera settles (ExploreControls), then the page opens
 */
function DockingOverlay({ path }: { path: string }) {
  const { craft, page } = stationNames[stationForPath(path)];
  return (
    <div className="explore-hud__docking" role="status">
      <span className="explore-hud__clamp explore-hud__clamp--left" aria-hidden="true" />
      <span className="explore-hud__clamp explore-hud__clamp--right" aria-hidden="true" />
      <span className="explore-hud__sweep" aria-hidden="true" />
      <div className="explore-hud__docking-text">
        <span>Docking at</span>
        <b>{craft}</b>
        <span className="explore-hud__docking-bar" aria-hidden="true">
          <span />
        </span>
        <span className="sr-only">Opening the {page} page</span>
      </div>
    </div>
  );
}

/**
 * Explore mode's heads-up display: how to fly, an exit, a marker for
 * every station (which sets the autopilot), the autopilot's status, a
 * docking prompt when you are close enough to a station to open its page
 * and the docking sequence once you do, and the hidden signals: how many
 * you have found, a detector, and what each one says.
 */
export function ExploreHud({
  onDockRequest,
  cv,
}: {
  onDockRequest: (path: string) => void;
  cv: WorldContent['cv'];
}) {
  const { mode } = useWorldMode();
  const exploring = mode === 'explore';
  const dock = useSyncExternalStore(onDock, readDock, noDock) as StationKey | '';
  const docking = useSyncExternalStore(onDocking, readDocking, noDock);
  const course = useAutopilot() as StationKey | '';
  const touch = useMediaQuery('(pointer: coarse)');
  // Phones held upright: the thumbsticks fill the bottom, so the autopilot's
  // status and the dock prompt sit under the top bar instead
  const compact = useMediaQuery('(pointer: coarse) and (max-width: 599px)');
  const lockable = useSyncExternalStore(subscribeNothing, canLockPointer, noLock);
  const locked = usePointerLocked();
  const exitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!exploring) return;
    exitRef.current?.focus({ preventScroll: true });
  }, [exploring]);

  // The cursor ring hides while the pointer is locked (World.scss)
  useEffect(() => {
    document.documentElement.toggleAttribute('data-pointer-lock', locked);
  }, [locked]);

  useEffect(() => {
    // Not while the autopilot is flying somewhere else, or already docking
    if (!exploring || !dock || course || docking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        onDockRequest(stationPaths[dock]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exploring, dock, course, docking, onDockRequest]);

  if (!exploring) return null;
  if (docking) {
    return (
      <div className="explore-hud" role="region" aria-label="Explore mode">
        <DockingOverlay path={docking} />
      </div>
    );
  }
  // The autopilot's status replaces the dock prompt until it arrives
  const status = (
    <>
      {course && (
        <div className="explore-hud__autopilot glass" role="status">
          <span className="explore-hud__autopilot-dot" aria-hidden="true" />
          <span>
            Autopilot to <b>{stationNames[course].page}</b>
          </span>
          <button type="button" className="explore-hud__exit" onClick={() => setAutopilot('')}>
            Take the controls
          </button>
        </div>
      )}

      {dock && !course && (
        <div className="explore-hud__dock glass" role="status">
          <span>
            Approaching <b>{stationNames[dock].craft}</b>
          </span>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onDockRequest(stationPaths[dock])}
          >
            Dock at {stationNames[dock].page}
            {!touch && <kbd>↵</kbd>}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="explore-hud" role="region" aria-label="Explore mode">
      <Waypoints />
      {/* Over the markers, under the rest of the HUD */}
      {touch && <TouchSticks />}

      <div className="explore-hud__head">
        <div className="explore-hud__top glass">
          <span className="explore-hud__title">
            <span className="explore-hud__dot" aria-hidden="true" />
            Explore mode
          </span>
          <SignalCount />
          <span className="explore-hud__keys">
            {touch ? (
              'Thumbsticks fly · tap a station for autopilot'
            ) : (
              <>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> fly · mouse {lockable ? 'looks' : 'steers'} · <kbd>Space</kbd>
                <kbd>C</kbd> up/down · <kbd>⇧</kbd> boost · <kbd>0</kbd>–<kbd>5</kbd> autopilot
              </>
            )}
          </span>
          <button
            ref={exitRef}
            type="button"
            className="explore-hud__exit"
            onClick={worldMode.exit}
          >
            Exit <kbd>Esc</kbd>
          </button>
        </div>
        <SignalDetector />
        {compact && status}
      </div>

      <SignalCard cv={cv} onPage={onDockRequest} />
      <BoostJet />

      {!touch && (
        <span
          className={`explore-hud__reticle${lockable ? ' explore-hud__reticle--locked' : ''}`}
          aria-hidden="true"
        />
      )}
      {!touch && lockable && (
        <p className="explore-hud__lock" role="status">
          {locked ? (
            <>
              <kbd>Esc</kbd> frees the mouse
            </>
          ) : (
            <>
              Click to steer · <kbd>Esc</kbd> to leave
            </>
          )}
        </p>
      )}

      {!compact && status}
    </div>
  );
}
