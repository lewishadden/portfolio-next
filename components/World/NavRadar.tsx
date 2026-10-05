'use client';

import { useEffect, useRef } from 'react';

import { navigableStations, stationNames, stationPositions } from './routes';
import { worldMode } from './worldMode';
import { onFlight, worldStore } from './worldStore';

import type { StationKey } from './routes';

const width = 150;
const height = 210;
const pad = 18;
/** How long the radar lingers after a flight lands */
const linger = 1400;

/** Map bounds: every navigable station, north (-Z) up */
const xs = navigableStations.map((key) => stationPositions[key][0]);
const zs = navigableStations.map((key) => stationPositions[key][2]);
const bounds = {
  minX: Math.min(...xs),
  maxX: Math.max(...xs),
  minZ: Math.min(...zs),
  maxZ: Math.max(...zs),
};
const scale = Math.min(
  (width - pad * 2) / (bounds.maxX - bounds.minX),
  (height - pad * 2) / (bounds.maxZ - bounds.minZ)
);
const toMap = (x: number, z: number): [number, number] => [
  width / 2 + (x - (bounds.minX + bounds.maxX) / 2) * scale,
  height / 2 + (z - (bounds.minZ + bounds.maxZ) / 2) * scale,
];

interface Colours {
  text: string;
  muted: string;
  violet: string;
  cyan: string;
  pink: string;
}

function readColours(): Colours {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string) => style.getPropertyValue(name).trim();
  return {
    text: get('--text-primary'),
    muted: get('--text-muted'),
    violet: get('--accent-primary'),
    cyan: get('--accent-secondary'),
    pink: get('--accent-tertiary'),
  };
}

function paint(ctx: CanvasRenderingContext2D, colours: Colours, font: string, now: number) {
  ctx.clearRect(0, 0, width, height);
  const flight = worldStore.flight;
  const camera = worldStore.camera;

  // Planned route
  if (flight.active && flight.path.length) {
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = colours.cyan;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (let i = 0; i < flight.path.length; i += 2) {
      const [x, y] = toMap(flight.path[i], flight.path[i + 1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Stations
  ctx.font = `500 8.5px ${font}`;
  ctx.textBaseline = 'middle';
  for (const key of navigableStations) {
    const [x, y] = toMap(stationPositions[key][0], stationPositions[key][2]);
    const target = flight.active && flight.to === key;
    if (target) {
      const pulse = (now / 900) % 1;
      ctx.strokeStyle = colours.pink;
      ctx.globalAlpha = 1 - pulse;
      ctx.beginPath();
      ctx.arc(x, y, 4 + pulse * 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = target ? colours.pink : colours.violet;
    ctx.beginPath();
    ctx.arc(x, y, target ? 3.6 : 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = target ? colours.text : colours.muted;
    const label = stationNames[key as StationKey].page.toUpperCase();
    const right = x < width / 2;
    ctx.textAlign = right ? 'left' : 'right';
    ctx.fillText(label, x + (right ? 7 : -7), y);
  }

  // The camera, pointing where it looks
  const [cx, cy] = toMap(camera.x, camera.z);
  const clampedX = Math.min(Math.max(cx, 6), width - 6);
  const clampedY = Math.min(Math.max(cy, 6), height - 6);
  ctx.save();
  ctx.translate(clampedX, clampedY);
  ctx.rotate(camera.heading);
  ctx.fillStyle = colours.cyan;
  ctx.shadowColor = colours.cyan;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * A small map of the world that appears while the camera is in flight (and
 * throughout tours and explore mode): every station, the planned route, the
 * destination and the camera's own position and heading.
 */
export function NavRadar() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!root || !canvas || !ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);

    let frame = 0;
    let lastActive = -Infinity;
    let colours = readColours();
    const font =
      getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono').trim() ||
      'ui-monospace, monospace';

    const tick = (now: number) => {
      const active = worldStore.flight.active || worldMode.get().mode !== 'page';
      if (active) lastActive = now;
      const show = now - lastActive < linger;
      root.classList.toggle('nav-radar--on', show);
      if (!show) {
        frame = 0;
        return;
      }
      paint(ctx, colours, font, now);
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      colours = readColours();
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const stopFlight = onFlight((event) => {
      if (event === 'start') start();
    });
    const stopMode = worldMode.subscribe(start);
    start();
    return () => {
      stopFlight();
      stopMode();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className="nav-radar glass" aria-hidden="true">
      <span className="nav-radar__title">Nav · sector map</span>
      <canvas ref={canvasRef} className="nav-radar__map" style={{ width, height }} />
    </div>
  );
}
