'use client';

import { ReactNode, useEffect, useSyncExternalStore } from 'react';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { IconifyLoader } from 'components/IconifyLoader/IconifyLoader';
import { motionLevel, subscribeMotion } from '@/utils/motion';

import type { MotionLevel } from '@/utils/motion';

/**
 * The motion level while hydrating: MotionConfig renders no markup of its
 * own, so it can take the level ThemeScript has already set, and entrances
 * that start as the page hydrates are held back from the first frame
 */
function hydratingLevel(): MotionLevel {
  if (typeof document === 'undefined') return 'full';
  const level = document.documentElement.dataset.motion;
  return level === 'calm' || level === 'still' ? level : 'full';
}

export function ClientProviders({ children }: { children: ReactNode }) {
  // Framer follows the site's motion level (the visitor's choice, or the OS setting)
  const motion = useSyncExternalStore(subscribeMotion, motionLevel, hydratingLevel);

  // The app is running: ThemeScript's failsafes (for an app that never starts) stand down
  useEffect(() => {
    document.documentElement.setAttribute('data-hydrated', '');
  }, []);

  return (
    <ThemeProvider>
      <IconifyLoader />
      <ReactLenis root options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}>
        <LazyMotion features={domAnimation}>
          <MotionConfig reducedMotion={motion === 'full' ? 'never' : 'always'}>
            {children}
          </MotionConfig>
        </LazyMotion>
      </ReactLenis>
    </ThemeProvider>
  );
}
