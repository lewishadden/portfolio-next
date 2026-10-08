'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

import { useInspection } from './inspection';
import { worldTip } from './worldStore';

const noTip = () => null;

/** Content prompts attach to the object; toy prompts can still follow the pointer. */
export function WorldTooltip() {
  const tip = useSyncExternalStore(worldTip.subscribe, worldTip.get, noTip);
  const selection = useInspection();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tip || selection) return;
    const place = (x: number, y: number, visible = true) => {
      const el = ref.current;
      if (!el) return;
      el.style.visibility = visible ? 'visible' : 'hidden';
      const left = Math.max(12, Math.min(window.innerWidth - el.offsetWidth - 12, x + 24));
      const top = Math.max(12, Math.min(window.innerHeight - el.offsetHeight - 12, y - 16));
      el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    };
    const move = (e: PointerEvent) => place(e.clientX, e.clientY);
    const project = (event: Event) => {
      const { x, y, visible } = (event as CustomEvent<{ x: number; y: number; visible: boolean }>).detail;
      place(x, y, visible);
    };
    if (tip.anchor) {
      window.addEventListener('world:tip-position', project);
      return () => window.removeEventListener('world:tip-position', project);
    }
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [tip, selection]);

  if (!tip || selection) return null;
  return (
    <div ref={ref} className="world-tip glass" aria-hidden="true" style={{ maxWidth: 'min(24rem, calc(100vw - 24px))' }}>
      {tip.anchor && <i style={{ position: 'absolute', right: '100%', top: '1rem', width: 20, borderTop: '1px solid var(--accent-secondary)' }} />}
      <b>{tip.label}</b>
      {tip.sub && <span>{tip.sub}</span>}
    </div>
  );
}
