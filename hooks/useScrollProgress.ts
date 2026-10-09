'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * How far down the page is scrolled, 0..100. `onProgress` is called with
 * it on every scroll (write it to the DOM there: nothing here re-renders
 * React as the page scrolls); `showBackToTop` turns true once the page is
 * half a screen down, and only its changes render.
 */
export const useScrollProgress = (onProgress?: (progress: number) => void) => {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const listener = useRef(onProgress);

  useEffect(() => {
    listener.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      listener.current?.(Math.min(Math.max(scrollPercent, 0), 100));
      // Same value, no render
      setShowBackToTop(scrollTop > window.innerHeight * 0.5);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return { showBackToTop };
};
