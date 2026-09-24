'use client';

import { useEffect, useRef } from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import './Cursor.scss';

const interactive = 'a, button, [role="button"], input, textarea, select, label, summary';

/**
 * A glowing ring that trails the native pointer (which stays visible) and
 * swells over interactive elements. Mouse + motion-OK users only.
 */
export function Cursor() {
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)');
  const reducedMotion = useReducedMotion();
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const enabled = fine && !reducedMotion;

  useEffect(() => {
    if (!enabled) return;
    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    const pos = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };
    let frame = 0;

    const onMove = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      const target = e.target instanceof Element ? e.target.closest(interactive) : null;
      ring.classList.toggle('cursor__ring--active', !!target);
      ring.classList.remove('cursor__ring--hidden');
      dot.classList.remove('cursor__dot--hidden');
    };
    const onLeave = () => {
      ring.classList.add('cursor__ring--hidden');
      dot.classList.add('cursor__dot--hidden');
    };
    const onDown = () => ring.classList.add('cursor__ring--down');
    const onUp = () => ring.classList.remove('cursor__ring--down');

    const loop = () => {
      ringPos.x += (pos.x - ringPos.x) * 0.18;
      ringPos.y += (pos.y - ringPos.y) * 0.18;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="cursor" aria-hidden="true">
      <div ref={ringRef} className="cursor__ring cursor__ring--hidden">
        <span />
      </div>
      <div ref={dotRef} className="cursor__dot cursor__dot--hidden" />
    </div>
  );
}

export default Cursor;
