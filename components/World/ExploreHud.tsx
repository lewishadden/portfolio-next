'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Icon } from '@iconify/react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { canLockPointer, usePointerLocked } from './pointerLock';
import { stationNames, stationPaths } from './routes';
import { useAutopilot, Waypoints } from './Waypoints';
import { useWorldMode, worldMode } from './worldMode';
import { exploreInput, onDock, setAutopilot, worldStore } from './worldStore';

import type { StationKey } from './routes';

const noDock = () => '';
const readDock = () => worldStore.dock;

/** Dragging the pad steers: up/down is forward/back, left/right strafes */
function TouchPad() {
  const padRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const pad = padRef.current;
    const knob = knobRef.current;
    if (!pad || !knob) return;
    let id = -1;
    const set = (e: PointerEvent) => {
      const rect = pad.getBoundingClientRect();
      const radius = rect.width / 2;
      let dx = (e.clientX - rect.left - radius) / radius;
      let dy = (e.clientY - rect.top - radius) / radius;
      const length = Math.hypot(dx, dy);
      if (length > 1) {
        dx /= length;
        dy /= length;
      }
      exploreInput.strafe = dx;
      exploreInput.forward = -dy;
      knob.style.transform = `translate(${dx * radius * 0.6}px, ${dy * radius * 0.6}px)`;
    };
    const down = (e: PointerEvent) => {
      id = e.pointerId;
      pad.setPointerCapture(id);
      set(e);
    };
    const move = (e: PointerEvent) => e.pointerId === id && set(e);
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      exploreInput.strafe = 0;
      exploreInput.forward = 0;
      knob.style.transform = '';
    };
    pad.addEventListener('pointerdown', down);
    pad.addEventListener('pointermove', move);
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    return () => {
      pad.removeEventListener('pointerdown', down);
      pad.removeEventListener('pointermove', move);
      pad.removeEventListener('pointerup', up);
      pad.removeEventListener('pointercancel', up);
    };
  }, []);

  const hold = (lift: number) => ({
    onPointerDown: () => {
      exploreInput.lift = lift;
    },
    onPointerUp: () => {
      exploreInput.lift = 0;
    },
    onPointerLeave: () => {
      exploreInput.lift = 0;
    },
  });

  return (
    <div className="explore-hud__touch">
      <div ref={padRef} className="explore-hud__pad" aria-hidden="true">
        <span ref={knobRef} className="explore-hud__knob" />
      </div>
      <div className="explore-hud__lift">
        <button type="button" aria-label="Rise" {...hold(1)}>
          <Icon icon="ph:caret-up-bold" width={18} height={18} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Sink" {...hold(-1)}>
          <Icon icon="ph:caret-down-bold" width={18} height={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

const noLock = () => false;
const subscribeNothing = () => () => {};

/**
 * Explore mode's heads-up display: how to fly, an exit, a marker for
 * every station (which sets the autopilot), the autopilot's status, and a
 * docking prompt when you are close enough to a station to open its page.
 */
export function ExploreHud({ onDockRequest }: { onDockRequest: (path: string) => void }) {
  const { mode } = useWorldMode();
  const exploring = mode === 'explore';
  const dock = useSyncExternalStore(onDock, readDock, noDock) as StationKey | '';
  const course = useAutopilot() as StationKey | '';
  const touch = useMediaQuery('(pointer: coarse)');
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
    if (!exploring || !dock) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        onDockRequest(stationPaths[dock]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exploring, dock, onDockRequest]);

  if (!exploring) return null;
  return (
    <div className="explore-hud" role="region" aria-label="Explore mode">
      <div className="explore-hud__top glass">
        <span className="explore-hud__title">
          <span className="explore-hud__dot" aria-hidden="true" />
          Explore mode
        </span>
        <span className="explore-hud__keys">
          {touch ? (
            'Pad to fly · drag to look · tap a station for autopilot'
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
        <button ref={exitRef} type="button" className="explore-hud__exit" onClick={worldMode.exit}>
          Exit <kbd>Esc</kbd>
        </button>
      </div>

      <Waypoints />

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

      {course && !dock && (
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

      {dock && (
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

      {touch && <TouchPad />}
    </div>
  );
}
