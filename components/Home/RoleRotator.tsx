'use client';

import { useEffect, useState } from 'react';

import { ScrambleText } from 'components/Motion/ScrambleText';

import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Terminal-style role line that decodes into the next title every few seconds */
export function RoleRotator({ titles, interval = 3200 }: { titles: string[]; interval?: number }) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || titles.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % titles.length), interval);
    return () => window.clearInterval(id);
  }, [titles.length, interval, reducedMotion]);

  return (
    <p className="hero__role">
      <span className="sr-only">{titles.join(', ')}</span>
      <span className="hero__role-line" aria-hidden="true">
        <span className="hero__role-prompt">&gt;_</span>
        <ScrambleText key={index} text={titles[index]} trigger="mount" duration={650} />
        <span className="hero__role-caret" />
      </span>
    </p>
  );
}

export default RoleRotator;
