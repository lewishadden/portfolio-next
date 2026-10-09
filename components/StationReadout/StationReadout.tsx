'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { rangeToGo, watchCourse } from 'components/HeaderHud/course';
import { rangeBetween, stationForPath, stationNames } from 'components/World/routes';
import { onFlight, worldStore } from 'components/World/worldStore';

import type { StationKey } from 'components/World/routes';

import './StationReadout.scss';

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
 * to go, counting down; its animation loop runs only then.
 */
export function StationReadout({ className = '' }: { className?: string }) {
  const key = stationForPath(usePathname());
  const leadRef = useRef<HTMLSpanElement>(null);
  const distanceRef = useRef<HTMLSpanElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);
  const fromHome = rangeBetween(key, 'home');

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
    </p>
  );
}

export default StationReadout;
