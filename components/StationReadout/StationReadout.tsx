'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { stationForPath, stationNames, stationPositions } from 'components/World/routes';
import { worldStore } from 'components/World/worldStore';

import './StationReadout.scss';

const home = stationPositions.home;
const fromHome = (x: number, y: number, z: number) =>
  Math.round(Math.hypot(x - home[0], y - home[1], z - home[2]));

/**
 * A line of telemetry under each page's heading: the craft the page is
 * docked at, and how far that is from Home. With the 3D world running the
 * distance is live (the camera's own), so it settles as the camera arrives
 * and drifts a little as the page scrolls; without it, the station's.
 */
export function StationReadout({ className = '' }: { className?: string }) {
  const key = stationForPath(usePathname());
  const distanceRef = useRef<HTMLSpanElement>(null);
  const [x, y, z] = stationPositions[key];
  const docked = fromHome(x, y, z);

  useEffect(() => {
    const el = distanceRef.current;
    if (!el) return;
    let frame = 0;
    let shown = docked;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const live = document.documentElement.dataset.world === 'on';
      const { camera } = worldStore;
      const next = live ? fromHome(camera.x, camera.y, camera.z) : docked;
      if (next === shown) return;
      shown = next;
      el.textContent = String(next);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [docked]);

  const { craft } = stationNames[key];
  return (
    <p className={`station-readout ${className}`}>
      <span className="station-readout__dot" aria-hidden="true" />
      <span>
        {key === 'lost' ? 'Adrift near the' : 'Docked at the'} <b>{craft.toLowerCase()}</b>
      </span>
      <span className="station-readout__sep" aria-hidden="true">
        /
      </span>
      {key === 'home' ? (
        <span>Home port</span>
      ) : (
        <span>
          <span ref={distanceRef} className="station-readout__km">
            {docked}
          </span>{' '}
          km from Home
        </span>
      )}
    </p>
  );
}

export default StationReadout;
