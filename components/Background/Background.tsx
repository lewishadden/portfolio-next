'use client';

import { useEffect, useState, useCallback } from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import './Background.scss';

const desktopParticleCount = 100;
const mobileParticleCount = 40;

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleCallbackLike = (deadline: IdleDeadlineLike) => void;

export const Background = () => {
  const [ready, setReady] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const particleCount = isMobile ? mobileParticleCount : desktopParticleCount;

  // Polyfill for requestIdleCallback and cancelIdleCallback
  const requestIdle = useCallback((cb: IdleCallbackLike) => {
    if ('requestIdleCallback' in window) {
      return requestIdleCallback(cb, { timeout: 4000 });
    }
    // Fallback: emulate IdleDeadline
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, 400);
  }, []);

  const cancelIdle = useCallback((id: number) => {
    if ('cancelIdleCallback' in window) {
      cancelIdleCallback(id);
    } else {
      clearTimeout(id);
    }
  }, []);

  // Delay heavy background rendering until browser is truly idle (after LCP)
  useEffect(() => {
    const id = requestIdle(() => setReady(true)) as number;
    return () => cancelIdle(id);
  }, [requestIdle, cancelIdle]);

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
