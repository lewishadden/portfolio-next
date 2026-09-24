import { useEffect, useRef } from 'react';

/**
 * Tracks the pointer over an element and exposes it as `--mx` / `--my`
 * (percentages) for the `.spotlight` glow. Optional 3D tilt.
 */
export function usePointerGlow<T extends HTMLElement = HTMLElement>({ tilt = 0 } = {}) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${x * 100}%`);
        el.style.setProperty('--my', `${y * 100}%`);
        if (tilt && !reduce) {
          el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * tilt}deg) rotateY(${(x - 0.5) * tilt}deg)`;
        }
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      if (tilt) el.style.transform = '';
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [tilt]);

  return ref;
}
