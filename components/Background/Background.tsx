'use client';

import { useEffect, useState } from 'react';
import './Background.scss';

const particleCount = 100;

export const Background = () => {
  const [ready, setReady] = useState(false);

  // Delay heavy background rendering until browser is truly idle (after LCP)
  useEffect(() => {
    const id = requestIdleCallback(() => setReady(true), { timeout: 4000 });
    return () => cancelIdleCallback(id);
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
