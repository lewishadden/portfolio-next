import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { MathUtils, Vector3 } from 'three';

import { motionLevel } from '@/utils/motion';

import { spawnPing } from './Pings';
import { flashNavLights } from './power';
import { emitCue, onShowcase, setWorldHover, worldStore, worldTip } from './worldStore';

import type { RefObject } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Object3D } from 'three';
import type { StationKey } from './routes';
import type { WorldTip } from './worldStore';

/**
 * Characters that notice you: they turn towards the pointer, lean in when
 * hovered and do a trick when clicked. State lives in a ref (it changes
 * every frame); the handlers and `stepReaction` mutate it.
 */
export interface Reaction {
  hovered: boolean;
  /** 0..1, eased towards hovered */
  amount: number;
  /** Eased pointer direction, -1..1 */
  yaw: number;
  pitch: number;
  /** Clock time of the last click, -Infinity before the first */
  trickAt: number;
  now: number;
}

export const createReaction = (): Reaction => ({
  hovered: false,
  amount: 0,
  yaw: 0,
  pitch: 0,
  trickAt: -Infinity,
  now: 0,
});

export function stepReaction(state: Reaction, t: number, dt: number) {
  state.now = t;
  state.amount = MathUtils.damp(state.amount, state.hovered ? 1 : 0, 6, dt);
  state.yaw = MathUtils.damp(state.yaw, worldStore.pointerX, 3.2, dt);
  state.pitch = MathUtils.damp(state.pitch, worldStore.pointerY, 3.2, dt);
}

/** Progress (0..1) of the click trick, or -1 when none is playing */
export function trickProgress(state: Reaction, duration: number) {
  const since = state.now - state.trickAt;
  return since >= 0 && since < duration ? since / duration : -1;
}

/** Ease in and out (0..1) */
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function hover(state: Reaction, on: boolean, tip: WorldTip) {
  if (state.hovered === on) return;
  state.hovered = on;
  setWorldHover(on);
  if (on) worldTip.set(tip);
  else if (worldTip.get() === tip) worldTip.set(null);
}

/** A point in world space (an R3F event's `e.point`) */
type Point = { x: number; y: number; z: number };

/** Starts the trick (unless one is already playing); `at` places its cue in space */
export function trick(state: Reaction, duration = 1, at?: Point) {
  if (state.now - state.trickAt < duration) return;
  state.trickAt = state.now;
  emitCue('trick', at ? { at: [at.x, at.y, at.z] } : undefined);
}

/**
 * Pointer handlers for a character: hover leans it in (and shows `tip`), a
 * click pings where it landed and plays its `duration`-second trick. Put
 * them on an invisible proxy (a capsule or sphere round the character), not
 * on the model: R3F raycasts everything under the object with the handlers,
 * and a GLB's triangles cost far more to test on every pointer move
 */
export function useReactionHandlers(state: RefObject<Reaction>, tip: WorldTip, duration = 1) {
  return useMemo(
    () => ({
      onPointerOver(e: ThreeEvent<PointerEvent>) {
        e.stopPropagation();
        hover(state.current, true, tip);
      },
      onPointerOut() {
        hover(state.current, false, tip);
      },
      onClick(e: ThreeEvent<MouseEvent>) {
        e.stopPropagation();
        spawnPing(e.point);
        trick(state.current, duration, e.point);
      },
    }),
    [state, tip, duration]
  );
}

const showcasePoint = new Vector3();

/** How long (ms) the still level keeps drawing after a hail, so its ping and blink play out */
const answerTime = 1400;

/** Asks for frames for `ms` (the still level draws on demand; elsewhere it costs nothing) */
function keepDrawing(invalidate: () => void, ms: number) {
  const until = performance.now() + ms;
  const frame = () => {
    invalidate();
    if (performance.now() < until) requestAnimationFrame(frame);
  };
  frame();
}

/**
 * Shows the character off when its station is asked to (`showcase()`: a
 * tour stop landing, or the visitor hailing it): a ping out from the
 * character and its `duration`-second trick. A tour's showcase is only for
 * full motion; at the still level a hail is answered with the ping and a
 * blink of the station's nav lights, nothing that moves
 */
export function useShowcase(
  station: StationKey,
  target: RefObject<Object3D | null>,
  state: RefObject<Reaction>,
  duration: number
) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(
    () =>
      onShowcase((key, reason) => {
        if (key !== station) return;
        const level = motionLevel();
        if (reason === 'tour' && level !== 'full') return;
        const object = target.current;
        if (!object) return;
        object.getWorldPosition(showcasePoint);
        spawnPing(showcasePoint);
        if (level === 'still') {
          flashNavLights(station);
          keepDrawing(invalidate, answerTime);
        } else {
          trick(state.current, duration, showcasePoint);
        }
      }),
    [station, target, state, duration, invalidate]
  );
}
