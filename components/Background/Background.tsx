'use client';

import { useEffect, useState, useCallback } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import './Background.scss';

const desktopParticleCount = 100;
const mobileParticleCount = 40;

export const Background = () => {
  const [ready, setReady] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const particleCount = isMobile ? mobileParticleCount : desktopParticleCount;

  const rIC = useCallback(
    (callback: () => void) =>
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(callback, { timeout: 4000 })
        : setTimeout(callback, 4000),
    []
  );
  // Delay heavy background rendering until browser is truly idle (after LCP)
  useEffect(() => {
    const id = rIC(() => setReady(true)) as number;
    return () =>
      typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id);
  }, []);

  return (
    <div className="bg-container" aria-hidden="true">
      {ready && (
        <>
          {/* Ambient gradient orbs */}
          <div className="bg-container__orb bg-container__orb--1" />
          <div className="bg-container__orb bg-container__orb--2" />
          <div className="bg-container__orb bg-container__orb--3" />

          {/* Floating particles */}
          <div className="bg-container__particles">
            {Array.from({ length: particleCount }, (_, i) => (
              <div className="bg-particle" key={i}>
                <div className="bg-particle__dot" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Background;
