'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

import { worldTip } from './worldStore';

const noTip = () => null;

/** A small label that follows the pointer while it is over something interactive in 3D */
export function WorldTooltip() {
  const tip = useSyncExternalStore(worldTip.subscribe, worldTip.get, noTip);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tip) return;
    const move = (e: PointerEvent) => {
      const el = ref.current;
      if (el) el.style.transform = `translate3d(${e.clientX + 18}px, ${e.clientY + 18}px, 0)`;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={ref} className="world-tip glass" aria-hidden="true">
      <b>{tip.label}</b>
      {tip.sub && <span>{tip.sub}</span>}
    </div>
  );
}
