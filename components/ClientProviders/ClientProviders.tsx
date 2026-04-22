'use client';

import { ReactNode } from 'react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import { ThemeProvider } from '@/contexts/ThemeContext';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ReactLenis root options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}>
        <LazyMotion features={domAnimation}>
          {children}
        </LazyMotion>
      </ReactLenis>
    </ThemeProvider>
  );
}
