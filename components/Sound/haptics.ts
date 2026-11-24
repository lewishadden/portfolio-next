import { useSyncExternalStore } from 'react';

import { worldMode } from 'components/World/worldMode';
import { onCue } from 'components/World/worldStore';
import { onSonar } from './detector';

import type { Cue, CueDetail } from 'components/World/worldStore';

/* ------------------------------------------------------------------
   Haptics: on a phone or tablet that can vibrate, free roam is felt as
   well as seen and heard (a knock against a hull, docking, a signal
   found, the last one found, the detector's sonar once it reads four
   bars), and so is the rocket launching after the contact form sends. They follow the world's cues (worldStore
   `emitCue`), whether or not sound is on. On by default where the device
   can vibrate; the command palette turns them off (localStorage
   `haptics` = 'off'). Nothing vibrates before the visitor has touched
   the page, which browsers refuse anyway. DOM-safe: World.tsx wires it.
   ------------------------------------------------------------------ */

const storageKey = 'haptics';

/** Vibration patterns: milliseconds on, off, on… */
export const hapticPatterns = {
  /** Harder knocks buzz longer (`strength` 0..1) */
  bump: (strength: number) => [Math.round(15 + 35 * Math.min(Math.max(strength, 0), 1))],
  dock: [12, 70, 28],
  found: [10, 40, 10, 40, 30],
  complete: [20, 40, 20, 40, 20, 40, 80],
  launch: [70, 30, 70, 30, 140],
  /** The detector's sonar, closing in on a signal (four bars or more) */
  sonar: [8],
  /** Turning haptics on: a nudge to say they are */
  on: [12],
};

let wanted: boolean | undefined;
let supported: boolean | undefined;
const listeners = new Set<() => void>();

function readOn() {
  if (wanted !== undefined) return wanted;
  try {
    wanted = localStorage.getItem(storageKey) !== 'off';
  } catch {
    wanted = true;
  }
  return wanted;
}

/**
 * The device can vibrate and is driven by touch: desktop Chrome has a
 * vibrate API with nothing to shake
 */
export function hapticsSupported() {
  supported ??=
    typeof navigator !== 'undefined' &&
    'vibrate' in navigator &&
    window.matchMedia('(pointer: coarse)').matches;
  return supported;
}

/** Vibrates, if haptics are on here and the visitor has interacted with the page */
export function buzz(pattern: number[]) {
  if (!hapticsSupported() || !readOn()) return;
  // Older browsers without userActivation enforce the gesture themselves
  const activation = (navigator as Partial<Navigator>).userActivation;
  if (activation && !activation.hasBeenActive) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Refused (a cross-origin frame, a policy): nothing to feel
  }
}

/** Free roam's knocks and finds, and the rocket launching wherever it does */
function feel(cue: Cue, detail?: CueDetail) {
  if (cue === 'launch') {
    buzz(hapticPatterns.launch);
    return;
  }
  if (worldMode.get().mode !== 'explore') return;
  if (cue === 'bump') buzz(hapticPatterns.bump(detail?.strength ?? 0.5));
  else if (cue === 'dock') buzz(hapticPatterns.dock);
  else if (cue === 'found') buzz(hapticPatterns.found);
  else if (cue === 'complete') buzz(hapticPatterns.complete);
}

/** The detector's sonar ticks once it reads this many bars */
const tickFrom = 4;

function tick(_at: readonly [number, number, number], bars: number) {
  if (bars >= tickFrom) buzz(hapticPatterns.sonar);
}

let wires = 0;
let unwire: (() => void) | null = null;

/**
 * Hooks haptics up to the world's cues where the device can vibrate
 * (World.tsx, on mount); returns the unhook
 */
export function wireHaptics() {
  if (!hapticsSupported()) return () => undefined;
  if (wires++ === 0) {
    const stopCues = onCue(feel);
    const stopSonar = onSonar(tick);
    unwire = () => {
      stopCues();
      stopSonar();
    };
  }
  return () => {
    if (--wires > 0) return;
    unwire?.();
    unwire = null;
  };
}

/** Haptics on or off (remembered); turning them on gives a nudge, so call it from a tap */
export function setHaptics(on: boolean) {
  wanted = on;
  try {
    if (on) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, 'off');
  } catch {
    // Storage blocked: the choice lasts until reload
  }
  if (on) buzz(hapticPatterns.on);
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const subscribeNever = () => () => undefined;
const serverOn = () => true;
const serverSupported = () => false;

/** Whether this device can vibrate, whether haptics are on, and a toggle (call it from a tap) */
export function useHaptics() {
  const can = useSyncExternalStore(subscribeNever, hapticsSupported, serverSupported);
  const on = useSyncExternalStore(subscribe, readOn, serverOn);
  return { supported: can, on, setHaptics };
}
