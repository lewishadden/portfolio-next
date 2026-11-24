'use client';

import { useEffect, useRef } from 'react';

import { motionLevel } from '@/utils/motion';

import type { ReactNode } from 'react';

import styles from './Magnet.module.scss';

interface MagnetProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

const transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
/** Furthest it pulls its child, in px */
const reach = 8;

/**
 * Pulls its child a few pixels towards a mouse pointer over it. Only at full
 * motion and for a fine pointer that hovers: touch's emulated mouse events
 * used to leave a tapped button pulled off centre. The plain `magnet` class
 * is for page styles that lay the wrapper out (e.g. full-width buttons on
 * phones).
 */
export default function Magnet({ children, strength = 0.35, className }: MagnetProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const pulls = (e: PointerEvent) =>
      e.pointerType === 'mouse' && fine.matches && motionLevel() === 'full';
    const clamp = (v: number) => Math.max(-reach, Math.min(reach, v));

    const onEnter = (e: PointerEvent) => {
      if (pulls(e)) el.style.transition = transition;
    };

    const onMove = (e: PointerEvent) => {
      if (!pulls(e)) return;
      const r = el.getBoundingClientRect();
      const dx = clamp((e.clientX - (r.left + r.width / 2)) * strength);
      const dy = clamp((e.clientY - (r.top + r.height / 2)) * strength);
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = 'none';
    };

    const onLeave = () => {
      if (!el.style.transform) return;
      el.style.transition = transition;
      el.style.transform = '';
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.style.transition = '';
      el.style.transform = '';
    };
  }, [strength]);

  return (
    <span ref={ref} className={`magnet ${styles.magnet}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
