'use client';

import { useEffect, useState } from 'react';

import { ScrambleText } from 'components/Motion/ScrambleText';
import { worldStore } from 'components/World/worldStore';

import { useReducedMotion } from '@/hooks/useReducedMotion';

/** The role line as shown, decoding included: the 3D world spells it round home's portal */
const showRole = (shown: string) => {
  worldStore.heroRole = shown;
};

/** Terminal-style role line that decodes into the next title every few seconds */
export function RoleRotator({ titles, interval = 3200 }: { titles: string[]; interval?: number }) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  // Gone with the page
  useEffect(() => () => showRole(''), []);

  useEffect(() => {
    if (reducedMotion || titles.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % titles.length), interval);
    return () => window.clearInterval(id);
  }, [titles.length, interval, reducedMotion]);

  return (
    <p className="hero__role" data-reading>
      <span className="sr-only">{titles.join(', ')}</span>
      <span className="hero__role-line" aria-hidden="true">
        <span className="hero__role-prompt">&gt;_</span>
        {/* Every title in one grid cell, only the current one shown: the line
            keeps the tallest title's height (a long one wraps on a phone),
            so nothing under it moves as the titles change */}
        <span className="hero__role-stack">
          {titles.map((title, i) => (
            <span
              key={`${i}-${title}`}
              className={`hero__role-title${i === index ? ' hero__role-title--on' : ''}`}
            >
              {i === index ? (
                <ScrambleText text={title} trigger="mount" duration={650} onFrame={showRole} />
              ) : (
                title
              )}
              <span className="hero__role-caret" />
            </span>
          ))}
        </span>
      </span>
    </p>
  );
}

export default RoleRotator;
