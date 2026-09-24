'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useReducedMotion } from '@/hooks/useReducedMotion';

const glyphs = '!<>-_\\/[]{}=+*^?#01ΔΣΛ';

/**
 * Decodes text through random glyphs — on mount, when it scrolls into view,
 * and optionally on hover. Screen readers always get the final text.
 */
export function ScrambleText({
  text,
  className = '',
  duration = 700,
  delay = 0,
  hover = false,
  trigger = 'view',
}: {
  text: string;
  className?: string;
  /** ms for the full decode */
  duration?: number;
  delay?: number;
  hover?: boolean;
  trigger?: 'view' | 'mount' | 'none';
}) {
  const [display, setDisplay] = useState(text);
  const frame = useRef(0);
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  const run = useCallback(() => {
    if (reducedMotion) return;
    cancelAnimationFrame(frame.current);
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const progress = Math.max(0, (now - start) / duration);
      const revealed = Math.floor(progress * text.length);
      let next = '';
      for (let i = 0; i < text.length; i++) {
        if (i < revealed || text[i] === ' ') next += text[i];
        else next += glyphs[Math.floor(Math.random() * glyphs.length)];
      }
      setDisplay(next);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
      else setDisplay(text);
    };
    frame.current = requestAnimationFrame(tick);
  }, [text, duration, delay, reducedMotion]);

  useEffect(() => {
    const el = ref.current;
    if (!el || trigger === 'none') return;
    if (trigger === 'mount') {
      run();
      return () => cancelAnimationFrame(frame.current);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [run, trigger]);

  return (
    <span
      ref={ref}
      className={className}
      onMouseEnter={hover ? run : undefined}
      onFocus={hover ? run : undefined}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}

export default ScrambleText;
