'use client';

import { useState, useEffect } from 'react';

export const useScrollProgress = () => {
  const [progress, setProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      const clamped = Math.min(scrollPercent, 100);

      setProgress(clamped);
      setShowBackToTop(scrollTop > window.innerHeight * 0.5);
      document.documentElement.style.setProperty('--scroll-pct', `${clamped}%`);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return { progress, showBackToTop };
};
