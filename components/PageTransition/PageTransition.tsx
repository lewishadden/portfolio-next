'use client';

import { useEffect } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useLenis } from 'lenis/react';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const lenis = useLenis();

  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
  }, [pathname, lenis]);

  return (
    <m.div
      key={pathname}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      style={{ overflow: 'clip' }}
    >
      {children}
    </m.div>
  );
}
