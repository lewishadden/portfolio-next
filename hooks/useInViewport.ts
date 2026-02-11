'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Returns a `ref` callback and a boolean `inViewport` that is `true`
 * when the referenced element is visible in the viewport.
 */
export function useInViewport<T extends HTMLElement = HTMLElement>(): {
  ref: (node: T | null) => void;
  inViewport: boolean;
} {
  const [inViewport, setInViewport] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    if (observer.current) {
      observer.current.disconnect();
      observer.current = null;
    }

    if (node) {
      observer.current = new IntersectionObserver(([entry]) => {
        setInViewport(entry.isIntersecting);
      });
      observer.current.observe(node);
    }
  }, []);

  return { ref, inViewport };
}
