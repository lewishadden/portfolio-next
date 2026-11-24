import { useEffect, useRef, useState } from 'react';

import { useBooted } from '@/components/World/boot';
import { useMotionLevel } from '@/hooks/useMotion';

/**
 * Counts up to `target` once the element scrolls into view, at full motion
 * only. Until the count starts it gives the real number (as the server HTML
 * does, for a visit without JavaScript or a crawler), never 0: the count
 * starts from 0 on its first frame, still hidden by the page's entrance.
 * Below full motion it is always the real number.
 */
export function useCountUp<T extends HTMLElement = HTMLElement>(
  target: number,
  duration = 1600
): [number, React.RefObject<T | null>] {
  // null until the count starts
  const [val, setVal] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const ref = useRef<T | null>(null);
  // Counts once the loading screen has lifted, so it is seen
  const booted = useBooted();
  const counting = useMotionLevel() === 'full';

  useEffect(() => {
    const el = ref.current;
    if (!el || !booted || !counting || started) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStarted(true);
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started, booted, counting]);

  useEffect(() => {
    if (!started || !counting) return;
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
  }, [started, counting, target, duration]);

  return [counting && val !== null ? val : target, ref];
}
