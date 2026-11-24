'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@iconify/react';

import { rangeToGo, watchCourse } from 'components/HeaderHud/course';
import { rangeBetween, stationForPath, stationNames } from 'components/World/routes';
import { onFlight, worldStore } from 'components/World/worldStore';

import { answersHail, hail, onHail } from './hail';

import type { StationKey } from 'components/World/routes';

import './StationReadout.scss';

/** How long what a hail did stays on screen (ms) */
const answerFor = 4500;

/**
 * What the 3D world shows at each station, in a line, for screen readers
 * (the canvas itself is aria-hidden). Only while the world is on: with it
 * off, the 2D render that stands in for it says what it shows in its own
 * alt text (StationFallback). /projects has none, its HUD showing the
 * screenshots instead
 */
const scenes: Record<StationKey, string> = {
  home: 'An astronaut with a laptop floats before a swirling portal.',
  about: "A spacesuit helmet turns slowly inside the crew habitat's rings.",
  experience: 'A satellite hangs over a long beam lit with a pod for each role.',
  projects: "A helix of floating screens, one for each project, winds round the yard's spine.",
  skills: 'Skill badges orbit a giant ringed planet, a constellation for each category.',
  contact: 'A rocket stands by a dish array that beams messages to a globe.',
  lost: 'A lost astronaut tumbles past a drifting wreck.',
};

/** What the readout says, docked or on the way */
const wording = (key: StationKey, enRoute: boolean) => ({
  lead: enRoute ? 'En route to the' : key === 'lost' ? 'Adrift near the' : 'Docked at the',
  tail: enRoute ? 'km' : 'km from Home',
});

/**
 * A line of telemetry under each page's heading: the craft the page is
 * docked at and how far that is from Home (rangeBetween, the same figure
 * in the server HTML, with the world on and with it off). While the camera
 * is flying here it reads "En route to the <craft>" with the range still
 * to go, counting down; its animation loop runs only then. With the
 * world up, a Hail button beside it asks the station to show off (see
 * hail.ts), and a status line says what it did.
 */
export function StationReadout({ className = '' }: { className?: string }) {
  const key = stationForPath(usePathname());
  const leadRef = useRef<HTMLSpanElement>(null);
  const distanceRef = useRef<HTMLSpanElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);
  const fromHome = rangeBetween(key, 'home');
  const [answer, setAnswer] = useState('');

  // What a hail did, from this button or the command palette, said for a moment
  useEffect(() => {
    let timer = 0;
    const stop = onHail((station, said) => {
      if (station !== key) return;
      setAnswer(said);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setAnswer(''), answerFor);
    });
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [key]);

  useEffect(() => {
    watchCourse();
    const lead = leadRef.current;
    const distance = distanceRef.current;
    const tail = tailRef.current;
    if (!lead || !distance || !tail) return;
    let frame = 0;
    let shown = '';
    const show = (enRoute: boolean, km: number) => {
      const text = `${enRoute}:${km}`;
      if (text === shown) return;
      shown = text;
      const words = wording(key, enRoute);
      lead.textContent = words.lead;
      distance.textContent = String(km);
      tail.textContent = words.tail;
      // Home's own readout says "Home port" once docked
      distance.parentElement?.toggleAttribute('data-en-route', enRoute);
    };
    const docked = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      show(false, fromHome);
    };
    const tick = () => {
      const toGo = rangeToGo();
      if (!toGo || toGo.to !== key) {
        docked();
        return;
      }
      show(true, toGo.km);
      frame = requestAnimationFrame(tick);
    };
    const fly = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    // The page arrives as the flight here sets off: it may be on its way already
    const { flight } = worldStore;
    if (flight.active && flight.to === key) fly();
    const stop = onFlight((event, to) => {
      if (to !== key) return;
      if (event === 'end') docked();
      else fly();
    });
    return () => {
      stop();
      cancelAnimationFrame(frame);
    };
  }, [key, fromHome]);

  const { craft } = stationNames[key];
  const words = wording(key, false);
  return (
    <p className={`station-readout ${className}`}>
      <span className="station-readout__dot" aria-hidden="true" />
      <span>
        <span ref={leadRef}>{words.lead}</span> <b>{craft.toLowerCase()}</b>
      </span>
      <span className="station-readout__sep" aria-hidden="true">
        /
      </span>
      <span
        className={`station-readout__range${key === 'home' ? ' station-readout__range--home' : ''}`}
      >
        <span ref={distanceRef} className="station-readout__km">
          {fromHome}
        </span>{' '}
        <span ref={tailRef}>{words.tail}</span>
      </span>
      {key === 'home' && <span className="station-readout__port">Home port</span>}
      <span className="station-readout__scene sr-only">In view: {scenes[key]}</span>
      {answersHail(key) && (
        <>
          {/* Shown only once the world is up to hear it (StationReadout.scss) */}
          <button
            type="button"
            className="station-readout__hail"
            aria-label={`Hail the ${craft.toLowerCase()}`}
            onClick={() => hail(key)}
          >
            <Icon icon="ph:broadcast-bold" width={13} height={13} aria-hidden="true" />
            <span>Hail</span>
          </button>
          <span className="station-readout__answer" role="status">
            {answer}
          </span>
        </>
      )}
    </p>
  );
}

export default StationReadout;
