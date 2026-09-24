'use client';

import { Icon } from '@iconify/react';

import { useScrollProgress } from '@/hooks/useScrollProgress';

import './ScrollProgress.scss';

const ringRadius = 22;
const ringLength = 2 * Math.PI * ringRadius;

export const ScrollProgress = () => {
  const { progress, showBackToTop } = useScrollProgress();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="scroll-progress" aria-hidden="true">
        <div className="scroll-progress__bar" style={{ transform: `scaleX(${progress / 100})` }} />
      </div>

      <button
        type="button"
        className={`back-to-top${showBackToTop ? ' back-to-top--visible' : ''}`}
        onClick={scrollToTop}
        aria-label={`Back to top (${Math.round(progress)}% scrolled)`}
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
            className="back-to-top__value"
            cx="26"
            cy="26"
            r={ringRadius}
            strokeDasharray={ringLength}
            strokeDashoffset={ringLength * (1 - progress / 100)}
          />
        </svg>
        <Icon icon="ph:arrow-up-bold" width={18} height={18} aria-hidden="true" />
      </button>
    </>
  );
};

export default ScrollProgress;
