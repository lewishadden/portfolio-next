import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useBooted } from '@/components/World/boot';

const subscribeNothing = () => () => {};

/**
 * Counts up to `target` once the element scrolls into view. The server HTML
 * (and so a visit without JavaScript, or a crawler) has the real number;
 * once hydrated it starts from 0, still hidden by the page's entrance
 */
export function useCountUp<T extends HTMLElement = HTMLElement>(
  target: number,
  duration = 1600
): [number, React.RefObject<T | null>] {
  const [val, setVal] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<T | null>(null);
  // Counts once the loading screen has lifted, so it is seen
  const booted = useBooted();
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || !booted) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) setStarted(true);
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started, booted]);

  useEffect(() => {
    if (!started) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);

  return [hydrated ? val : target, ref];
}
