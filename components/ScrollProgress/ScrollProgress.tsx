'use client';

import { Icon } from '@iconify/react';

import { useScrollProgress } from '@/hooks/useScrollProgress';

import './ScrollProgress.scss';

export const ScrollProgress = () => {
  const { progress, showBackToTop } = useScrollProgress();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div
        className="scroll-progress"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Page scroll progress"
      >
        <div className="scroll-progress__bar" style={{ width: `${progress}%` }} />
      </div>

      <button
        type="button"
        className={`back-to-top${showBackToTop ? ' back-to-top--visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Back to top"
      >
        <Icon icon="mdi:chevron-up" width={24} height={24} aria-hidden="true" />
      </button>
    </>
  );
};

export default ScrollProgress;
