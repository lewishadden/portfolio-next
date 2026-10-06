'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';

import { worldMode } from 'components/World/worldMode';
import { worldStore } from 'components/World/worldStore';

import { statsOverlay, useStatsOverlay } from './statsStore';

import './StatsOverlay.scss';

const formatCount = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);

/**
 * "Stats for nerds": live frame rate and renderer counters for the 3D
 * world (⌥⇧S / Alt+Shift+S, or the command palette). Updates its text
 * directly each frame, so React never re-renders while it runs.
 */
export function StatsOverlay() {
  const open = useStatsOverlay();
  const fpsRef = useRef<HTMLElement>(null);
  const graphRef = useRef<HTMLCanvasElement>(null);
  const bodyRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    let last = performance.now();
    let window0 = last;
    let frames = 0;
    let worst = 0;
    const history: number[] = [];
    const ctx = graphRef.current?.getContext('2d');

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      frames += 1;
      worst = Math.max(worst, dt);
      history.push(dt);
      if (history.length > 90) history.shift();

      if (now - window0 >= 500) {
        const fps = (frames * 1000) / (now - window0);
        if (fpsRef.current) fpsRef.current.textContent = fps.toFixed(0);
        const s = worldStore.stats;
        const world = document.documentElement.dataset.world === 'on';
        const c = worldStore.camera;
        const lines = [
          `frame   ${(1000 / fps).toFixed(1)} ms  (worst ${worst.toFixed(0)} ms)`,
          world
            ? `draws   ${s.calls}   tris ${formatCount(s.triangles)}   pts ${formatCount(s.points)}`
            : 'world   off',
          world ? `gpu     ${s.geometries} geo · ${s.textures} tex · ${s.programs} programs` : '',
          world
            ? `canvas  ${s.width}×${s.height} @${s.dpr.toFixed(2)}x  tier ${document.documentElement.dataset.worldTier ?? '–'}`
            : '',
          world
            ? `camera  ${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}  ${worldStore.velocity.toFixed(1)} u/s`
            : '',
          world
            ? `station ${s.station}  mode ${worldMode.get().mode}${worldStore.flight.active ? `  flight ${(worldStore.flight.progress * 100).toFixed(0)}%` : ''}`
            : '',
        ].filter(Boolean);
        if (bodyRef.current) bodyRef.current.textContent = lines.join('\n');
        window0 = now;
        frames = 0;
        worst = 0;
      }

      if (ctx) {
        const { width, height } = ctx.canvas;
        ctx.clearRect(0, 0, width, height);
        history.forEach((ms, i) => {
          const h = Math.min(height, (ms / 50) * height);
          ctx.fillStyle = ms > 33 ? '#fb7185' : ms > 17.5 ? '#fbbf24' : '#22d3ee';
          ctx.fillRect(i * (width / 90), height - h, width / 90 - 0.5, h);
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;
  return (
    <aside className="stats-overlay glass" aria-label="Rendering statistics">
      <header className="stats-overlay__head">
        <span>
          <b ref={fpsRef}>–</b> fps
        </span>
        <button
          type="button"
          className="stats-overlay__close"
          onClick={() => statsOverlay.set(false)}
          aria-label="Close statistics"
        >
          <Icon icon="ph:x-bold" width={14} height={14} aria-hidden="true" />
        </button>
      </header>
      <canvas
        ref={graphRef}
        className="stats-overlay__graph"
        width={180}
        height={34}
        aria-hidden="true"
      />
      <pre ref={bodyRef} className="stats-overlay__body" />
    </aside>
  );
}

export default StatsOverlay;
