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
 * stations' showcase listeners). The projects yard has no answer, so it
 * offers no hail
 */
const answers: Partial<Record<StationKey, string>> = {
  home: 'The astronaut does a barrel roll',
  about: 'The helmet spins',
  experience: 'The satellite rolls and pings the beam',
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
 * Hails a station: it performs its trick, the hail sounds from where it
 * floats, and listeners (the readout's status line) hear what happened.
 * Returns that, or '' when it doesn't answer
 */
export function hail(station: StationKey) {
  const answer = hailAnswer(station);
  if (!answer) return '';
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
