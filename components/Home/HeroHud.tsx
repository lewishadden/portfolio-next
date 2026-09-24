'use client';

import { useEffect, useState } from 'react';

const formatTime = () =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/London',
  }).format(new Date());

/** Sci-fi readout along the bottom of the hero: coordinates, UK local time, scroll cue */
export function HeroHud({ location }: { location: string }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(formatTime());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="hero__hud">
      <dl className="hero__hud-stats">
        <div>
          <dt>Coordinates</dt>
          <dd>52.57°N · 0.24°W</dd>
        </div>
        <div>
          <dt>Base</dt>
          <dd>{location}</dd>
        </div>
        <div>
          <dt>Local time</dt>
          <dd>
            <time suppressHydrationWarning>{time ?? '--:--:--'}</time>
          </dd>
        </div>
      </dl>
      <span className="hero__scroll" aria-hidden="true">
        <span className="hero__scroll-mouse">
          <span className="hero__scroll-wheel" />
        </span>
        Scroll to explore
      </span>
    </div>
  );
}

export default HeroHud;
