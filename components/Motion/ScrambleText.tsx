'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useBooted } from '@/components/World/boot';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// ASCII only, so mid-decode text is exactly as wide as the final text in a
// monospace font (Greek letters fell back to a wider font), and no '-' or
// '/', which let a decoding word break across lines. Exported for anything
// else that draws the decode (home's portal ring spells the role line)
export const scrambleGlyphs = '!<>_\\[]{}=+*^?#01';

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
  onFrame,
}: {
  text: string;
  className?: string;
  /** ms for the full decode */
  duration?: number;
  delay?: number;
  hover?: boolean;
  trigger?: 'view' | 'mount' | 'none';
  /** Called with the text as shown whenever it changes: on mount, then every decode frame */
  onFrame?: (shown: string) => void;
}) {
  const [display, setDisplay] = useState(text);
  const frame = useRef(0);
  const onFrameRef = useRef(onFrame);
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  // Decodes once the loading screen has lifted, so it is seen
  const booted = useBooted();

  useEffect(() => {
    onFrameRef.current = onFrame;
  });

  // Reports what is shown (the 3D world spells the hero's role line out):
  // the text as it mounts, then each decode frame as it is drawn
  useEffect(() => {
    onFrameRef.current?.(text);
  }, [text]);

  const run = useCallback(() => {
    if (reducedMotion) return;
    cancelAnimationFrame(frame.current);
    const start = performance.now() + delay;
    const show = (shown: string) => {
      setDisplay(shown);
      onFrameRef.current?.(shown);
    };
    const tick = (now: number) => {
      const progress = Math.max(0, (now - start) / duration);
      if (progress >= 1) {
        show(text);
        return;
      }
      const revealed = Math.floor(progress * text.length);
      let next = '';
      for (let i = 0; i < text.length; i++) {
        if (i < revealed || text[i] === ' ') next += text[i];
        else next += scrambleGlyphs[Math.floor(Math.random() * scrambleGlyphs.length)];
      }
      show(next);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [text, duration, delay, reducedMotion]);

  useEffect(() => {
    const el = ref.current;
    if (!el || trigger === 'none' || !booted) return;
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
  }, [run, trigger, booted]);

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
