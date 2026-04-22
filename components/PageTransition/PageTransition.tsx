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
      initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </m.div>
  );
}
