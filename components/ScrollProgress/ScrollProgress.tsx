'use client';

import { useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';

import { useScrollProgress } from '@/hooks/useScrollProgress';

import './ScrollProgress.scss';

const ringRadius = 22;
const ringLength = 2 * Math.PI * ringRadius;

/**
 * A thin bar across the top of the screen showing how far down the page
 * is (hidden while the header is a HUD, which shows it along its own
 * bottom edge), and a back-to-top button whose ring fills with it. Both
 * are written straight to the DOM as the page scrolls
 */
export const ScrollProgress = () => {
  const barRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const onProgress = useCallback((progress: number) => {
    barRef.current?.style.setProperty('transform', `scaleX(${(progress / 100).toFixed(4)})`);
    ringRef.current?.setAttribute(
      'stroke-dashoffset',
      (ringLength * (1 - progress / 100)).toFixed(2)
    );
  }, []);
  const { showBackToTop } = useScrollProgress(onProgress);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="scroll-progress" aria-hidden="true">
        <div ref={barRef} className="scroll-progress__bar" style={{ transform: 'scaleX(0)' }} />
      </div>

      <button
        type="button"
        className={`back-to-top${showBackToTop ? ' back-to-top--visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Back to top"
        tabIndex={showBackToTop ? 0 : -1}
      >
        <svg className="back-to-top__ring" viewBox="0 0 52 52" aria-hidden="true">
          <defs>
            <linearGradient id="back-to-top-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--gradient-start)" />
              <stop offset="100%" stopColor="var(--gradient-end)" />
            </linearGradient>
          </defs>
          <circle className="back-to-top__track" cx="26" cy="26" r={ringRadius} />
          <circle
            ref={ringRef}
            className="back-to-top__value"
            cx="26"
            cy="26"
            r={ringRadius}
            strokeDasharray={ringLength}
            strokeDashoffset={ringLength}
          />
        </svg>
        <Icon icon="ph:arrow-up-bold" width={18} height={18} aria-hidden="true" />
      </button>
    </>
  );
};

export default ScrollProgress;
