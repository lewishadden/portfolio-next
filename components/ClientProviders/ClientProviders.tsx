'use client';

import { ReactNode, useEffect } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { IconifyLoader } from 'components/IconifyLoader/IconifyLoader';

export function ClientProviders({ children }: { children: ReactNode }) {
  // The app is running: ThemeScript's failsafes (for an app that never starts) stand down
  useEffect(() => {
    document.documentElement.setAttribute('data-hydrated', '');
  }, []);

  return (
    <ThemeProvider>
      <IconifyLoader />
      <ReactLenis root options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}>
        <LazyMotion features={domAnimation}>
          <MotionConfig reducedMotion="user">{children}</MotionConfig>
        </LazyMotion>
      </ReactLenis>
    </ThemeProvider>
  );
}
