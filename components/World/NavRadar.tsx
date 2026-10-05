'use client';

import { useEffect, useRef } from 'react';

import { navigableStations, stationNames, stationPositions } from './routes';
import { worldMode } from './worldMode';
import { onFlight, worldStore } from './worldStore';

import type { StationKey } from './routes';

/* ------------------------------------------------------------------
   Sector map: the world in miniature, drawn in 3D and to scale while
   the camera flies (and throughout tours and explore mode). One uniform
   scale on every axis, so distances and heights are true; each station
   stands on a stalk above a ground grid to show its height, the planned
   route is the real flight curve, and the camera is an arrow pointing
   the way it looks. The view sways a little so it reads as 3D.
   ------------------------------------------------------------------ */

const width = 236;
const height = 176;
const pad = 20;
/** How long the map lingers after a flight lands */
const linger = 1400;
/** Map view: turned so the line of stations runs corner to corner, looking down */
const baseYaw = 0.62;
const sway = 0.16;
const tilt = 0.92;
/** One world unit is drawn as a kilometre on the scale bar */
const unit = 'km';

const points = navigableStations.map((key) => stationPositions[key]);
const centre = [0, 1, 2].map(
  (axis) => (Math.min(...points.map((p) => p[axis])) + Math.max(...points.map((p) => p[axis]))) / 2
);
const groundY = Math.min(...points.map((p) => p[1])) - 10;
const gridStep = 40;
const extent = {
  minX: Math.min(...points.map((p) => p[0])) - 30,
  maxX: Math.max(...points.map((p) => p[0])) + 30,
  minZ: Math.min(...points.map((p) => p[2])) - 30,
  maxZ: Math.max(...points.map((p) => p[2])) + 30,
};

interface View {
  cos: number;
  sin: number;
  scale: number;
}

/** Orthographic projection: [screen x, screen y, depth (bigger is nearer)] */
function project(view: View, x: number, y: number, z: number): [number, number, number] {
  const dx = x - centre[0];
  const dy = y - centre[1];
  const dz = z - centre[2];
  const rx = dx * view.cos - dz * view.sin;
  const rz = dx * view.sin + dz * view.cos;
  const sy = rz * Math.sin(tilt) - dy * Math.cos(tilt);
  return [
    width / 2 + rx * view.scale,
    height / 2 + 6 + sy * view.scale,
    rz * Math.cos(tilt) + dy * Math.sin(tilt),
  ];
}

/** One scale for every frame: fits the stations and grid at either end of the sway */
const fitScale = (() => {
  let span = { x: 0, y: 0 };
  for (const yaw of [baseYaw - sway, baseYaw, baseYaw + sway]) {
    const view = { cos: Math.cos(yaw), sin: Math.sin(yaw), scale: 1 };
    const corners: [number, number, number][] = [];
    for (const p of points) corners.push(p, [p[0], groundY, p[2]]);
    const projected = corners.map(([x, y, z]) => project(view, x, y, z));
    const xs = projected.map((p) => p[0] - width / 2);
    const ys = projected.map((p) => p[1] - height / 2 - 6);
    span = {
      x: Math.max(span.x, ...xs.map(Math.abs)),
      y: Math.max(span.y, ...ys.map(Math.abs)),
    };
  }
  return Math.min((width / 2 - pad) / span.x, (height / 2 - pad) / span.y);
})();

/** A round number of units that draws 30-60px long */
const scaleBar = [10, 20, 25, 50, 100].find((n) => n * fitScale >= 30) ?? 100;

interface Colours {
  text: string;
  muted: string;
  violet: string;
  cyan: string;
  pink: string;
  grid: string;
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
    grid: get('--border-strong'),
  };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Beside the dot, trying right, left, then above and below, until it fits clear */
function placeLabel(label: string, x: number, y: number, w: number, placed: Box[]) {
  const h = 9;
  const spots: Box[] = [
    { x: x + 7, y: y - h / 2 - 1, w, h },
    { x: x - 7 - w, y: y - h / 2 - 1, w, h },
    { x: x + 6, y: y - h - 5, w, h },
    { x: x + 6, y: y + 4, w, h },
    { x: x - 6 - w, y: y - h - 5, w, h },
    { x: x - 6 - w, y: y + 4, w, h },
  ];
  const inside = (b: Box) => b.x >= 2 && b.x + b.w <= width - 2 && b.y >= 2;
  const box =
    spots.find((b) => inside(b) && !placed.some((p) => overlaps(p, b))) ??
    spots.find(inside) ??
    spots[0];
  placed.push(box);
  return box;
}

function paint(
  ctx: CanvasRenderingContext2D,
  colours: Colours,
  font: string,
  now: number,
  still: boolean
) {
  ctx.clearRect(0, 0, width, height);
  const yaw = still ? baseYaw : baseYaw + Math.sin(now / 4200) * sway;
  const view: View = { cos: Math.cos(yaw), sin: Math.sin(yaw), scale: fitScale };
  const flight = worldStore.flight;
  const camera = worldStore.camera;

  // Ground grid
  ctx.lineWidth = 1;
  ctx.strokeStyle = colours.grid;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (let x = Math.ceil(extent.minX / gridStep) * gridStep; x <= extent.maxX; x += gridStep) {
    const a = project(view, x, groundY, extent.minZ);
    const b = project(view, x, groundY, extent.maxZ);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  for (let z = Math.ceil(extent.minZ / gridStep) * gridStep; z <= extent.maxZ; z += gridStep) {
    const a = project(view, extent.minX, groundY, z);
    const b = project(view, extent.maxX, groundY, z);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Planned route, with how far along it the camera is
  if (flight.active && flight.path.length) {
    const route: [number, number][] = [];
    for (let i = 0; i < flight.path.length; i += 3) {
      const [x, y] = project(view, flight.path[i], flight.path[i + 1], flight.path[i + 2]);
      route.push([x, y]);
    }
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = colours.cyan;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    route.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  }

  // Stations, far to near, each on a stalk down to the grid
  const target = flight.active ? flight.to : '';
  const stations = navigableStations
    .map((key) => {
      const [x, y, z] = stationPositions[key];
      return { key, top: project(view, x, y, z), foot: project(view, x, groundY, z) };
    })
    .sort((a, b) => a.top[2] - b.top[2]);
  ctx.font = `500 8.5px ${font}`;
  ctx.textBaseline = 'middle';
  const placed: Box[] = [];
  for (const { key, top, foot } of stations) {
    const isTarget = key === target;
    ctx.strokeStyle = isTarget ? colours.pink : colours.violet;
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(foot[0], foot[1]);
    ctx.lineTo(top[0], top[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(foot[0], foot[1], 3, 1.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (isTarget) {
      const pulse = (now / 900) % 1;
      ctx.strokeStyle = colours.pink;
      ctx.globalAlpha = 1 - pulse;
      ctx.beginPath();
      ctx.arc(top[0], top[1], 4 + pulse * 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = isTarget ? colours.pink : colours.violet;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(top[0], top[1], isTarget ? 3.6 : 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = isTarget ? colours.text : colours.muted;
    const label = stationNames[key as StationKey].page.toUpperCase();
    const box = placeLabel(label, top[0], top[1], ctx.measureText(label).width, placed);
    ctx.textAlign = 'left';
    ctx.fillText(label, box.x, box.y + box.h / 2);
  }

  // The camera: an arrow at its position, pointing the way it looks
  const eye = project(view, camera.x, camera.y, camera.z);
  const ahead = project(
    view,
    camera.x + camera.fx * 20,
    camera.y + camera.fy * 20,
    camera.z + camera.fz * 20
  );
  const ex = Math.min(Math.max(eye[0], 7), width - 7);
  const ey = Math.min(Math.max(eye[1], 7), height - 7);
  const angle = Math.atan2(ahead[0] - eye[0], -(ahead[1] - eye[1]));
  const below = project(view, camera.x, groundY, camera.z);
  ctx.strokeStyle = colours.cyan;
  ctx.globalAlpha = 0.35;
  ctx.setLineDash([1, 2]);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(Math.min(Math.max(below[0], 7), width - 7), Math.min(below[1], height - 4));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(angle);
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

  // Scale bar
  const barLength = scaleBar * fitScale;
  const bx = width - 10 - barLength;
  const by = height - 9;
  ctx.strokeStyle = colours.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx, by - 3);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + barLength, by);
  ctx.lineTo(bx + barLength, by - 3);
  ctx.stroke();
  ctx.fillStyle = colours.muted;
  ctx.textAlign = 'right';
  ctx.fillText(`${scaleBar} ${unit}`, bx - 5, by - 1);

  // Distance left to the destination
  if (target) {
    const [tx, ty, tz] = stationPositions[target as StationKey];
    const left = Math.hypot(tx - camera.x, ty - camera.y, tz - camera.z);
    const label = `→ ${stationNames[target as StationKey].page.toUpperCase()}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = colours.text;
    ctx.fillText(label, 8, by - 1);
    ctx.fillStyle = colours.cyan;
    ctx.fillText(`${Math.round(left)} ${unit}`, 14 + ctx.measureText(label).width, by - 1);
  }
}

/**
 * A small 3D map of the world that appears while the camera is in flight
 * (and throughout tours and explore mode): every station at its true
 * position, the planned route, the destination and the camera itself.
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
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      paint(ctx, colours, font, now, still);
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
      <span className="nav-radar__title">Nav · sector map · to scale</span>
      <canvas ref={canvasRef} className="nav-radar__map" style={{ width, height }} />
    </div>
  );
}
