'use client';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '@iconify/react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { SoundToggle } from 'components/Sound/SoundToggle';

import { canLockPointer, usePointerLocked } from './pointerLock';
import {
  sectorCentre,
  sectorRadius,
  stationForPath,
  stationKeys,
  stationNames,
  stationPaths,
} from './routes';
import { signals, useFoundSignals } from './signalStore';
import { SignalCard, SignalCount, SignalDetector } from './SignalsHud';
import { useAutopilot, Waypoints } from './Waypoints';
import { useWorldMode, worldMode } from './worldMode';
import {
  emitCue,
  exploreInput,
  onDock,
  onDocking,
  setAutopilot,
  worldBumpEvent,
  worldStore,
} from './worldStore';

import type { ReactNode } from 'react';
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

/** Controls that act on Enter themselves */
const enterTargets =
  'button, a[href], input, textarea, select, [role="button"], [contenteditable]:not([contenteditable="false"])';

/** Enter pressed here belongs to the focused control, not to the HUD's dock shortcut */
function ownsEnter(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(enterTargets);
}

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
 * thrusting: the ship's engines flare at the corners of the view (Cockpit,
 * in the canvas), and this says so for screen readers. Read each frame,
 * not rendered by React
 */
function BoostStatus() {
  const ref = useRef<HTMLSpanElement>(null);

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
      if (boosting === on) return;
      on = boosting;
      el.toggleAttribute('data-on', on);
      el.textContent = on ? 'Boost' : '';
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <span ref={ref} className="explore-hud__jet sr-only" role="status" />;
}

const noLock = () => false;
const subscribeNothing = () => () => {};
const readDocking = () => worldStore.docking;

/** Something interactive in 3D is pointed at (html[data-world-hover], setWorldHover) */
const subscribeHover = (listener: () => void) => {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-world-hover'],
  });
  return () => observer.disconnect();
};
const readHover = () => document.documentElement.hasAttribute('data-world-hover');

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
 * A knock against a hull (worldBumpEvent): the screen's edges flash and a
 * warning blinks under the reticle, harder for a harder knock
 */
function HullContact() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onBump = (e: Event) => {
      el.style.setProperty('--impact', String((e as CustomEvent<number>).detail));
      // Restart the flash
      el.classList.remove('explore-hud__impact--on');
      void el.offsetWidth;
      el.classList.add('explore-hud__impact--on');
    };
    window.addEventListener(worldBumpEvent, onBump);
    return () => window.removeEventListener(worldBumpEvent, onBump);
  }, []);

  return (
    <div ref={ref} className="explore-hud__impact" aria-hidden="true">
      <span className="explore-hud__impact-label">Hull contact</span>
    </div>
  );
}

/** What the autopilot is flying to, by name: a station's page, or a signal ('signal:<id>') */
function courseName(course: string) {
  if ((stationKeys as readonly string[]).includes(course)) {
    return stationNames[course as StationKey].page;
  }
  return signals.find((signal) => `signal:${signal.id}` === course)?.name ?? course;
}

/** The edge warning shows once worldStore.edge reaches this, and goes once it falls back below that */
const edgeNear = 0.6;
const edgeClear = 0.3;

/** Where the ship meets the edge of the world: straight out from the sector's middle */
function edgePoint(): [number, number, number] {
  const { x, y, z } = worldStore.camera;
  const [cx, cy, cz] = sectorCentre;
  const length = Math.hypot(x - cx, y - cy, z - cz) || 1;
  const k = sectorRadius / length;
  return [cx + (x - cx) * k, cy + (y - cy) * k, cz + (z - cz) * k];
}

/**
 * Nearing the edge of the world (worldStore.edge, as the shimmer shows
 * it): a status line says the ship is being turned back, with the `edge`
 * cue once per approach
 */
function EdgeWarning() {
  const [near, setNear] = useState(false);

  useEffect(() => {
    let frame = 0;
    let on = false;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const edge = worldStore.edge;
      if (!on && edge >= edgeNear) {
        on = true;
        setNear(true);
        emitCue('edge', { at: edgePoint(), strength: edge });
      } else if (on && edge <= edgeClear) {
        on = false;
        setNear(false);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <p className="explore-hud__edge" role="status">
      {near ? 'Sector edge · turning back' : ''}
    </p>
  );
}

/* ----------------- Learning to fly: the coach and the key legend ----------------- */

/** localStorage: set once the visitor has been through (or skipped) the coach */
const trainedKey = 'roam-trained';

function readTrained() {
  try {
    return localStorage.getItem(trainedKey) === '1';
  } catch {
    return false;
  }
}

function saveTrained() {
  try {
    localStorage.setItem(trainedKey, '1');
  } catch {
    // Storage blocked: remembered for this visit
  }
}

/** How the visitor flies: a locked mouse looks, a free one steers, touch has thumbsticks */
type Pilot = 'lock' | 'steer' | 'touch';
type CoachStep = 'look' | 'fly' | 'course';
const coachSteps: CoachStep[] = ['look', 'fly', 'course'];

/** Mouse travel (px, locked) that counts as having looked around */
const lookTravel = 60;
/** How long the coach says it is done before it goes (ms) */
const coachOutro = 2600;

const coachCopy: Record<CoachStep, Record<Pilot, ReactNode>> = {
  look: {
    lock: <>Look around: move the mouse</>,
    steer: <>Steer: rest the mouse away from the middle</>,
    touch: <>Look around: hold the right thumbstick over</>,
  },
  fly: {
    lock: (
      <>
        Fly: <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd>, <kbd>⇧</kbd> to boost
      </>
    ),
    steer: (
      <>
        Fly: <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd>, <kbd>⇧</kbd> to boost
      </>
    ),
    touch: <>Fly: push the left thumbstick, out to its ring to boost</>,
  },
  course: {
    lock: (
      <>
        Set a course: <kbd>0</kbd>–<kbd>5</kbd>, or find a hidden signal
      </>
    ),
    steer: (
      <>
        Set a course: click a station or press <kbd>0</kbd>–<kbd>5</kbd>, or find a hidden signal
      </>
    ),
    touch: <>Set a course: tap a station, or find a hidden signal</>,
  },
};

const stepNames: Record<CoachStep, string> = {
  look: 'look around',
  fly: 'fly',
  course: 'set a course',
};

/**
 * The first free roam teaches itself: three steps, each ticked off as the
 * visitor does it (looking round, flying or boosting, setting the
 * autopilot or finding a signal), in words for how they fly. Done or
 * skipped, it is remembered (localStorage `roam-trained`) and doesn't
 * show again
 */
function Coach({ pilot, onDone }: { pilot: Pilot; onDone: () => void }) {
  const [done, setDone] = useState<Record<CoachStep, boolean>>({
    look: false,
    fly: false,
    course: false,
  });
  const found = useFoundSignals();
  const [foundBefore] = useState(found.length);

  useEffect(() => {
    let frame = 0;
    let travel = 0;
    const mark = (step: CoachStep) =>
      setDone((current) => (current[step] ? current : { ...current, [step]: true }));
    const onMove = (e: PointerEvent) => {
      if (!document.pointerLockElement) return;
      travel += Math.abs(e.movementX) + Math.abs(e.movementY);
      if (travel > lookTravel) mark('look');
    };
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const input = exploreInput;
      const steering = Math.max(Math.abs(input.steerX), Math.abs(input.steerY)) > 0.25;
      const stick = Math.max(Math.abs(input.stickX), Math.abs(input.stickY)) > 0.3;
      if (steering || stick || input.turn || input.pitch) mark('look');
      if (input.forward || input.strafe || input.lift) mark('fly');
      if (worldStore.autopilot) mark('course');
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  const ticked = { ...done, course: done.course || found.length > foundBefore };
  const current = coachSteps.find((step) => !ticked[step]);

  useEffect(() => {
    if (current) return;
    const id = window.setTimeout(onDone, coachOutro);
    return () => window.clearTimeout(id);
  }, [current, onDone]);

  return (
    <section className="explore-hud__coach glass" aria-label="Flight training">
      <ol className="explore-hud__coach-steps">
        {coachSteps.map((step) => (
          <li
            key={step}
            className="explore-hud__coach-step"
            data-done={ticked[step] || undefined}
            aria-current={step === current ? 'step' : undefined}
          >
            <span className="explore-hud__coach-mark" aria-hidden="true" />
            <span>{coachCopy[step][pilot]}</span>
            {ticked[step] && <span className="sr-only"> (done)</span>}
          </li>
        ))}
      </ol>
      {current ? (
        <button type="button" className="explore-hud__exit" onClick={onDone}>
          Skip
        </button>
      ) : (
        <p className="explore-hud__coach-done">All set. The keys are under Controls.</p>
      )}
      <p className="sr-only" role="status">
        {current ? `Next: ${stepNames[current]}` : 'Training done'}
      </p>
    </section>
  );
}

/** Every control, for how the visitor flies */
function KeyLegend({ pilot }: { pilot: Pilot }) {
  if (pilot === 'touch') return <>Thumbsticks fly · tap a station for autopilot</>;
  return (
    <>
      <kbd>W</kbd>
      <kbd>A</kbd>
      <kbd>S</kbd>
      <kbd>D</kbd> fly · mouse {pilot === 'lock' ? 'looks' : 'steers'} · <kbd>Space</kbd>
      <kbd>C</kbd> up/down · <kbd>R</kbd>
      <kbd>V</kbd> pitch · <kbd>⇧</kbd> boost · <kbd>E</kbd> click · <kbd>0</kbd>–<kbd>5</kbd>{' '}
      autopilot
    </>
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
  const course = useAutopilot();
  const touch = useMediaQuery('(pointer: coarse)');
  // Phones held upright: the thumbsticks fill the bottom, so the autopilot's
  // status and the dock prompt sit under the top bar instead
  const compact = useMediaQuery('(pointer: coarse) and (max-width: 599px)');
  const lockable = useSyncExternalStore(subscribeNothing, canLockPointer, noLock);
  const locked = usePointerLocked();
  const targeting = useSyncExternalStore(subscribeHover, readHover, noLock);
  const regionRef = useRef<HTMLDivElement>(null);
  const pilot: Pilot = touch ? 'touch' : lockable ? 'lock' : 'steer';
  // Until the coach is done the key legend shows; after, it waits behind a button
  const [trained, setTrained] = useState(readTrained);
  const [legendOpen, setLegendOpen] = useState(false);
  const legendId = useId();
  const finishTraining = useCallback(() => {
    saveTrained();
    setTrained(true);
  }, []);

  // Keyboard focus moves into the HUD (the page under it is inert). The
  // region itself takes it, not a control in it: Enter is then the dock
  // shortcut, and Space flies up rather than pressing a button
  useEffect(() => {
    if (!exploring) return;
    regionRef.current?.focus({ preventScroll: true });
  }, [exploring]);

  // The cursor ring hides while the pointer is locked (World.scss)
  useEffect(() => {
    document.documentElement.toggleAttribute('data-pointer-lock', locked);
  }, [locked]);

  useEffect(() => {
    // Not while the autopilot is flying somewhere else, or already docking
    if (!exploring || !dock || course || docking) return;
    const onKey = (e: KeyboardEvent) => {
      // Enter on a focused control is that control's (a station marker sets
      // the autopilot), never a dock as well
      if (e.key !== 'Enter' || ownsEnter(e.target)) return;
      e.preventDefault();
      onDockRequest(stationPaths[dock]);
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
            Autopilot to <b>{courseName(course)}</b>
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
    <div
      ref={regionRef}
      className="explore-hud"
      role="region"
      aria-label="Explore mode"
      tabIndex={-1}
    >
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
          {trained && (
            <button
              type="button"
              className="explore-hud__exit explore-hud__controls"
              aria-expanded={legendOpen}
              aria-controls={legendId}
              onClick={() => setLegendOpen((open) => !open)}
            >
              <Icon icon="ph:keyboard" width={16} height={16} aria-hidden="true" />
              Controls
            </button>
          )}
          <span id={legendId} className="explore-hud__keys" hidden={trained && !legendOpen}>
            <KeyLegend pilot={pilot} />
          </span>
          <SoundToggle />
          <button type="button" className="explore-hud__exit" onClick={worldMode.exit}>
            Exit {!touch && <kbd>Esc</kbd>}
          </button>
        </div>
        <SignalDetector />
        {!trained && <Coach pilot={pilot} onDone={finishTraining} />}
        {compact && status}
      </div>

      <SignalCard cv={cv} onPage={onDockRequest} />
      <BoostStatus />
      <HullContact />
      <EdgeWarning />

      {!touch && (
        <span
          className={[
            'explore-hud__reticle',
            lockable && 'explore-hud__reticle--locked',
            targeting && 'explore-hud__reticle--target',
          ]
            .filter(Boolean)
            .join(' ')}
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
