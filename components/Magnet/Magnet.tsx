'use client';

import { useEffect, useRef, ReactNode } from 'react';
import styles from './Magnet.module.scss';

interface MagnetProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

const TRANSITION = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';

export default function Magnet({ children, strength = 0.35, className }: MagnetProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

    const onEnter = () => {
      el.style.transition = TRANSITION;
    };

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = clamp((e.clientX - (r.left + r.width / 2)) * strength, 8);
      const dy = clamp((e.clientY - (r.top + r.height / 2)) * strength, 8);
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = 'none';
    };

    const onLeave = () => {
      el.style.transition = TRANSITION;
      el.style.transform = 'translate(0,0)';
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [strength]);

  return (
    <span ref={ref} className={`${styles.magnet}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
