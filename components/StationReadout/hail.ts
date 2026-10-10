import { stationNames, stationPositions } from 'components/World/routes';
import { emitCue, showcase } from 'components/World/worldStore';
import { motionLevel } from '@/utils/motion';

import type { StationKey } from 'components/World/routes';

/* ------------------------------------------------------------------
   Hailing a station (G2): the readout's Hail button and the command
   palette ask the station to show off (showcase, which each station's
   listener answers with its trick) and say what happens. DOM-safe.
   ------------------------------------------------------------------ */

/**
 * What each station does when hailed, at full and calm motion (the
 * stations' showcase listeners). A station without an answer offers no hail
 */
const answers: Partial<Record<StationKey, string>> = {
  home: 'The astronaut does a barrel roll',
  about: 'The helmet spins',
  experience: 'The satellite rolls and pings the beam',
  projects: 'The screens light up one after another down the helix',
  skills: 'Every constellation flares',
  contact: 'The comms array transmits and the rocket revs',
  lost: 'The lost astronaut tumbles',
};

/** Whether the station answers a hail */
export const answersHail = (station: StationKey) => station in answers;

/** What the station does when hailed now: at the still level it only pings back */
export function hailAnswer(station: StationKey) {
  const answer = answers[station];
  if (!answer) return '';
  return motionLevel() === 'still'
    ? `The ${stationNames[station].craft.toLowerCase()} answers with a ping`
    : answer;
}

type HailListener = (station: StationKey, answer: string) => void;
const listeners = new Set<HailListener>();

/** The world is up to hear it: 3D effects on and the canvas drawing */
export const canHail = () =>
  document.documentElement.dataset.world === 'on' && !!document.querySelector('.world--ready');

/**
 * How long a station takes to answer before it hears another hail (ms):
 * longer than its trick (about 1s), its ping (0.9s) and, at the still
 * level, its run of nav-light flashes. Each answer flashes, so hails can't
 * come faster than this: a held Enter on the Hail button repeats its click
 * at the key-repeat rate (up to 30 a second), well past 3 flashes a second
 */
const hailCooldown = 1200;
const lastHail: Partial<Record<StationKey, number>> = {};

/**
 * Hails a station: it performs its trick, the hail sounds from where it
 * floats, and listeners (the readout's status line) hear what happened.
 * Returns that, or '' when it doesn't answer (or is still answering the
 * last hail, when the status line keeps saying what that did)
 */
export function hail(station: StationKey) {
  const answer = hailAnswer(station);
  if (!answer) return '';
  const now = performance.now();
  if (now - (lastHail[station] ?? -Infinity) < hailCooldown) return '';
  lastHail[station] = now;
  showcase(station, 'hail');
  emitCue('hail', { at: stationPositions[station] });
  listeners.forEach((listener) => listener(station, answer));
  return answer;
}

/** Subscribe to hails (and what each one did) */
export function onHail(listener: HailListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
