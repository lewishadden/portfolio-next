'use client';

import { createContext, useContext, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';

import { pastStamp } from './clock';
import { smootherstep } from './flight';
import { stationKeys, stationPositions } from './routes';
import { worldMode } from './worldMode';
import { emitCue, onFlight, worldStore } from './worldStore';

import type { ReactNode } from 'react';
import type { StationKey } from './routes';

/* ------------------------------------------------------------------
   Station power. A flight's destination drops to standby as the camera
   sets off (it is far off by then), and powers on as the camera makes
   its final approach: two false starts, then the glows surge past full
   and settle, the hull's windows flick on a few at a time and the nav
   lights come on one after another. Its glow materials (rings, beams,
   halos: `uCharge`), hull (accent strips and windows) and NavLights all
   read the station's power, so one value drives the whole craft.
   Only page flights power stations down: without flights (reduced
   motion) and outside page mode (the tour, free roam) every station
   stays powered, and one left waiting when the mode changed mid-flight
   powers back up. While a station isn't fully powered its charge is
   published in `worldStore.charge` (its voice follows it).
   ------------------------------------------------------------------ */

/** Glows while a station waits for the camera */
const standby = 0.12;
/** Seconds a power-on takes, end to end */
const powerOnTime = 2;
/** A destination closer than this when the flight sets off is in plain view: it stays on */
const nearby = 45;

export interface StationPower {
  /** Glow strength: 1 powered, `standby` waiting, past 1 as it surges on */
  charge: { value: number };
  /** Share of the hull's windows lit, 0..1 */
  windows: { value: number };
  /** Clock time (seconds) the power-on began, -1 when not powering on */
  onAt: number;
  /** What it is heading for when not powering on: 1 or `standby` */
  target: number;
  /** Clock time its nav lights last blinked in answer to a hail (-Infinity: never) */
  flashAt: number;
}

export const stationPower = Object.fromEntries(
  stationKeys.map((key) => [
    key,
    { charge: { value: 1 }, windows: { value: 1 }, onAt: -1, target: 1, flashAt: -Infinity },
  ])
) as Record<StationKey, StationPower>;

/** Glow over a power-on, `s` seconds in: two false starts, a surge past full, then it settles */
function chargeAt(s: number) {
  if (s < 0.1) return 0.55;
  if (s < 0.2) return standby;
  if (s < 0.3) return 0.8;
  if (s < 0.42) return 0.22;
  if (s < 0.95) return MathUtils.lerp(0.22, 1.4, smootherstep((s - 0.42) / 0.53));
  return 1 + 0.4 * Math.exp(-(s - 0.95) * 3.2);
}

/** Share of windows lit over a power-on (each window has its own threshold in the shader) */
const windowsAt = (s: number) => MathUtils.clamp((s - 0.3) / 1.1, 0, 1);

/**
 * How bright a station's nav light `index` is over a power-on: dark in
 * standby, then each in turn flashes on, a beat after the one before
 */
export function navPower(key: StationKey, index: number, t: number) {
  const power = stationPower[key];
  if (power.onAt < 0) return MathUtils.lerp(0.06, 1, power.windows.value);
  const s = t - power.onAt - 0.45 - index * 0.11;
  if (s < 0) return 0.06;
  return s < 0.14 ? 2.6 : 1;
}

/** How long each nav light's answering blink lasts, and the beat between one light and the next (s) */
const flashTime = 0.2;
const flashStep = 0.07;
/** How bright a nav light is at the height of its answering blink */
export const navBlink = 2.6;

/**
 * Whether a station's nav light `index` is blinking in answer to a hail:
 * each blinks once, one after another. The blink stands in for the light's
 * own pattern rather than scaling it, so a white strobe (dark most of the
 * time, and held wherever it stopped at the still level) blinks too
 */
export function navBlinking(key: StationKey, index: number, t: number) {
  const blink = t - stationPower[key].flashAt - index * flashStep;
  return blink >= 0 && blink < flashTime;
}

/** Stations whose nav lights blink on the next frame */
const flashes = new Set<StationKey>();

/** Blinks a station's nav lights once, one after another (a hail's answer when nothing may move) */
export function flashNavLights(key: StationKey) {
  flashes.add(key);
}

type Pending = { event: 'start' | 'approach' | 'end'; to: string };
const pending: Pending[] = [];

function distanceTo(key: StationKey) {
  const [x, y, z] = stationPositions[key];
  const camera = worldStore.camera;
  return Math.hypot(camera.x - x, camera.y - y, camera.z - z);
}

/** Only page flights drop a station to standby (see stepPower) */
const paging = () => worldMode.get().mode === 'page';

function handle({ event, to }: Pending, t: number) {
  for (const key of stationKeys) {
    const power = stationPower[key];
    if (key !== to) {
      // Retargeted mid-flight: whatever was waiting powers back up
      if (event === 'start' && power.target < 1 && power.onAt < 0) power.target = 1;
      continue;
    }
    if (event === 'start' && paging() && distanceTo(key) > nearby) {
      power.target = standby;
      power.onAt = -1;
    } else if (event === 'approach' && power.target < 1) {
      power.target = 1;
      power.onAt = t;
      emitCue('power', { at: stationPositions[key] });
    }
  }
}

/** Within this of full power, a station easing back up is fully powered */
const settled = 0.002;

/** Publishes a station's charge while it isn't fully powered (absent: fully powered) */
function publishCharge(key: StationKey, charge: number) {
  if (charge === 1) delete worldStore.charge[key];
  else worldStore.charge[key] = charge;
}

function stepPower(t: number, dt: number) {
  while (pending.length) handle(pending.shift()!, t);
  for (const key of flashes) stationPower[key].flashAt = t;
  flashes.clear();
  // The tour and free roam never leave a station waiting: one a flight left
  // in standby when the mode changed (it never got its approach) powers up
  const holdUp = !paging();
  for (const key of stationKeys) {
    const power = stationPower[key];
    power.flashAt = pastStamp(power.flashAt, t);
    if (holdUp && power.target < 1) power.target = 1;
    if (power.onAt >= 0) {
      const s = t - power.onAt;
      power.charge.value = chargeAt(s);
      power.windows.value = windowsAt(s);
      // Done, or begun before R3F restarted its clock: it finishes at once
      if (s > powerOnTime || s < 0) {
        power.onAt = -1;
        power.charge.value = 1;
        power.windows.value = 1;
      }
      publishCharge(key, power.charge.value);
      continue;
    }
    // Fading to standby, or back up after a change of course
    power.charge.value = MathUtils.damp(power.charge.value, power.target, 5, dt);
    power.windows.value = MathUtils.damp(power.windows.value, power.target < 1 ? 0 : 1, 5, dt);
    if (power.target === 1 && Math.abs(power.charge.value - 1) < settled) {
      power.charge.value = 1;
      if (power.windows.value > 1 - settled) power.windows.value = 1;
    }
    publishCharge(key, power.charge.value);
  }
}

/** Runs every station's power from the camera's flights; mount once in the canvas */
export function PowerDriver() {
  useEffect(() => {
    const off = onFlight((event, to) => pending.push({ event, to }));
    return () => {
      off();
      for (const key of stationKeys) delete worldStore.charge[key];
    };
  }, []);
  useFrame(({ clock }, delta) => stepPower(clock.elapsedTime, Math.min(delta, 0.05)));
  return null;
}

const StationContext = createContext<StationKey | null>(null);

/** The station the parts inside belong to (their power), set by StationScope */
export const useStationKey = () => useContext(StationContext);

/** Wraps a station's tree so its parts (nav lights) follow its power */
export function StationScope({ station, children }: { station: StationKey; children: ReactNode }) {
  return <StationContext.Provider value={station}>{children}</StationContext.Provider>;
}
