'use client';

import { useEffect, useRef } from 'react';

import { rangeToGo, watchCourse } from '@/components/HeaderHud/course';
import { copyHeldFor } from '@/components/PageTransition/pageSnapshot';
import { motionLevel } from '@/utils/motion';

import {
  navigableStations,
  sectorCentre,
  sectorRadius,
  stationKeys,
  stationNames,
  stationPositions,
} from './routes';
import {
  contactName,
  currentScan,
  detectorRange,
  isFound,
  isScanned,
  scanClock,
  scanSweep,
  signalAt,
  signals,
} from './signalStore';
import { worldMode } from './worldMode';
import { onFlight, onPreview, worldStore } from './worldStore';

import type { StationKey } from './routes';
import type { Signal, WorldPoint } from './signalStore';

/* ------------------------------------------------------------------
   Sector map: the world in miniature, drawn in 3D and to scale while
   the camera flies to a new page (until its final approach, when the
   page's copy arrives), and throughout tours and explore mode. One
   uniform scale on every axis, so distances and heights are true; each
   station stands on a stalk above a ground grid to show its height, the
   planned route is the real flight curve, and the camera is an arrow
   pointing the way it looks. The view sways a little so it reads as 3D.
   Hovering or focusing a link to another station plots the course there
   first (worldStore.preview), marching towards it, before anything is
   clicked: on wide layouts only, where the map opens beside the station
   (stacked layouts have the copy all the way across). It never shows
   over the page's copy: not for the warp in (whose page is already
   showing), and never over the element that has keyboard focus.
   In free roam it follows the autopilot (its course, worldStore.
   autopilotPath, marching to its goal, a station or a signal, and the
   distance left), plots the signals found (hollow rings, the comet where
   it has flown on to, the derelict as a craft), the contacts sonar scans
   have picked out (amber, with each scan's sweep) and the edge of the world,
   and zooms out as far as it must to keep the camera, the goal and those
   finds on the map (the scale bar follows), back in as they come closer.
   ------------------------------------------------------------------ */

/** The course being previewed, when there is no flight: its station and path */
function previewed() {
  const { flight, preview, previewPath } = worldStore;
  return !flight.active && preview && previewPath.length ? preview : '';
}

const width = 236;
const height = 176;
const pad = 20;
/** How long the map lingers once a flight reaches its approach (or a mode ends), and after a previewed course is let go */
const linger = 300;
const previewLinger = 350;
/** Every how many frames the map checks it is clear of the focused element */
const focusEvery = 4;
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

/** Round lengths the scale bar can show (units) */
const barLengths = [10, 20, 25, 50, 100, 200, 250, 500];

/** A round number of units that draws 30-60px long at `scale` */
const scaleBarFor = (scale: number) => barLengths.find((n) => n * scale >= 30) ?? 500;

/**
 * Free roam zooms out from the stations' fit to keep the camera, its
 * course's goal and the signals it has plotted on the map, and back in as
 * they come closer: how fast (per second) out and in
 */
const zoomOut = 4;
const zoomIn = 1.5;
/** Zoomed out past this share of the stations' fit, only the destination is named */
const crowdedBelow = 0.55;
/** The edge of the world as the map draws it: a circle on the ground, this many points round */
const edgeSteps = 64;

interface Colours {
  text: string;
  muted: string;
  violet: string;
  cyan: string;
  pink: string;
  grid: string;
  amber: string;
}

function readColours(root: HTMLElement): Colours {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string) => style.getPropertyValue(name).trim();
  return {
    text: get('--text-primary'),
    muted: get('--text-muted'),
    violet: get('--accent-primary'),
    cyan: get('--accent-secondary'),
    pink: get('--accent-tertiary'),
    grid: get('--border-strong'),
    // The free roam HUD's signal colour, which the map sets for itself
    amber: getComputedStyle(root).getPropertyValue('--signal').trim() || '#fbbf24',
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
  // Clear of the bottom line (the distance left and the scale bar)
  const inside = (b: Box) =>
    b.x >= 2 && b.x + b.w <= width - 2 && b.y >= 2 && b.y + b.h <= height - 17;
  const box =
    spots.find((b) => inside(b) && !placed.some((p) => overlaps(p, b))) ??
    spots.find(inside) ??
    spots[0];
  placed.push(box);
  return box;
}

type Point = [number, number, number];

/**
 * A signal free roam has plotted on the map: found ones as hollow rings
 * (the derelict as a craft), contacts a scan picked out as amber dots
 */
interface Plot {
  signal: Signal;
  at: Point;
  found: boolean;
}

const scratch: WorldPoint = { x: 0, y: 0, z: 0 };

const pointOf = (signal: Signal): Point => {
  const { x, y, z } = signalAt(signal, scratch);
  return [x, y, z];
};

/** The signals the map plots in free roam: those found or scanned (the comet where it is now) */
function plotted(): Plot[] {
  return signals
    .filter((signal) => isFound(signal.id) || isScanned(signal.id))
    .map((signal) => ({ signal, at: pointOf(signal), found: isFound(signal.id) }));
}

const isStation = (course: string): course is StationKey =>
  (stationKeys as readonly string[]).includes(course);

/** Where the autopilot's course leads ('<station>' or 'signal:<id>'), and what the map calls it */
function courseGoal(course: string): { at: Point; label: string; station: StationKey | '' } | null {
  if (isStation(course)) {
    return { at: stationPositions[course], label: stationNames[course].page, station: course };
  }
  const signal = signals.find((s) => `signal:${s.id}` === course);
  if (!signal) return null;
  // Unfound, it is only a contact: its name is what finding it tells you
  const label = isFound(signal.id) ? signal.name : contactName(signal.id);
  return { at: pointOf(signal), label, station: '' };
}

/** The largest scale (up to the stations' fit) that keeps every point on the map */
function fitAll(view: View, keep: Point[]) {
  let scale = fitScale;
  for (const [x, y, z] of keep) {
    const [px, py] = project(view, x, y, z);
    const dx = Math.abs(px - width / 2);
    const dy = Math.abs(py - height / 2 - 6);
    if (dx > 1e-3) scale = Math.min(scale, (width / 2 - pad) / dx);
    if (dy > 1e-3) scale = Math.min(scale, (height / 2 - pad) / dy);
  }
  return scale;
}

/** The map's zoom in free roam, eased between frames */
interface Zoom {
  scale: number;
  /** When it was last drawn (ms) */
  at: number;
}

/** Traces the edge of the world (sectorRadius round sectorCentre) on the ground */
function traceEdge(ctx: CanvasRenderingContext2D, view: View) {
  ctx.beginPath();
  for (let i = 0; i <= edgeSteps; i++) {
    const angle = (i / edgeSteps) * Math.PI * 2;
    const [x, y] = project(
      view,
      sectorCentre[0] + Math.cos(angle) * sectorRadius,
      groundY,
      sectorCentre[2] + Math.sin(angle) * sectorRadius
    );
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** Grid lines across the ground every `step` units between the extents */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  view: View,
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
  step: number
) {
  ctx.beginPath();
  for (let x = Math.ceil(area.minX / step) * step; x <= area.maxX; x += step) {
    const a = project(view, x, groundY, area.minZ);
    const b = project(view, x, groundY, area.maxZ);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  for (let z = Math.ceil(area.minZ / step) * step; z <= area.maxZ; z += step) {
    const a = project(view, area.minX, groundY, z);
    const b = project(view, area.maxX, groundY, z);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
}

/** The whole sector, for free roam's grid (clipped to the edge of the world) */
const sectorArea = {
  minX: sectorCentre[0] - sectorRadius,
  maxX: sectorCentre[0] + sectorRadius,
  minZ: sectorCentre[2] - sectorRadius,
  maxZ: sectorCentre[2] + sectorRadius,
};

/** A dotted stalk from a point down (or up) to the ground grid, showing its height */
function stalk(
  ctx: CanvasRenderingContext2D,
  top: number[],
  foot: number[],
  colour: string,
  alpha: number
) {
  ctx.strokeStyle = colour;
  ctx.globalAlpha = alpha;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(foot[0], foot[1]);
  ctx.lineTo(top[0], top[1]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/**
 * A ring pulsing out round the destination. Below full motion it holds
 * still, as the map's sway and marching dashes do
 */
function pulse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colour: string,
  now: number,
  still: boolean
) {
  const phase = still ? 0.5 : (now / 900) % 1;
  ctx.strokeStyle = colour;
  ctx.globalAlpha = still ? 0.55 : 1 - phase;
  ctx.beginPath();
  ctx.arc(x, y, 4 + phase * 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function paint(
  ctx: CanvasRenderingContext2D,
  colours: Colours,
  font: string,
  now: number,
  still: boolean,
  zoom: Zoom
) {
  ctx.clearRect(0, 0, width, height);
  const yaw = still ? baseYaw : baseYaw + Math.sin(now / 4200) * sway;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const flight = worldStore.flight;
  const camera = worldStore.camera;
  const exploring = worldMode.get().mode === 'explore';
  const plots = exploring ? plotted() : [];
  const goal = exploring && worldStore.autopilot ? courseGoal(worldStore.autopilot) : null;

  // Free roam can range far beyond the stations: the map zooms out to keep
  // the camera, the course's goal and every find on it (eased; at once below
  // full motion), and back in as they come home. Otherwise it fits the stations
  if (exploring) {
    const keep: Point[] = [[camera.x, camera.y, camera.z], ...plots.map((plot) => plot.at)];
    if (goal) keep.push(goal.at);
    const fit = fitAll({ cos, sin, scale: 1 }, keep);
    const dt = Math.min(Math.max(now - zoom.at, 0) / 1000, 0.1);
    const rate = fit < zoom.scale ? zoomOut : zoomIn;
    zoom.scale = still ? fit : zoom.scale + (fit - zoom.scale) * (1 - Math.exp(-rate * dt));
  } else {
    zoom.scale = fitScale;
  }
  zoom.at = now;
  const view: View = { cos, sin, scale: zoom.scale };

  // Ground grid: under the stations, or in free roam the whole sector out to
  // its edge, every 40 units (wider apart as the map zooms out)
  ctx.lineWidth = 1;
  ctx.strokeStyle = colours.grid;
  ctx.globalAlpha = 0.5;
  if (exploring) {
    const step = [40, 80, 160].find((n) => n * view.scale >= 14) ?? 160;
    ctx.save();
    traceEdge(ctx, view);
    ctx.clip();
    drawGrid(ctx, view, sectorArea, step);
    ctx.restore();
  } else {
    drawGrid(ctx, view, extent, gridStep);
  }
  ctx.globalAlpha = 1;

  // The edge of the world, brighter as the ship nears it (worldStore.edge)
  if (exploring) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = colours.amber;
    ctx.globalAlpha = 0.45 + 0.55 * worldStore.edge;
    traceEdge(ctx, view);
    ctx.stroke();
    ctx.restore();
  }

  // A sonar scan sweeping out from where the ship was, to detector range
  const scan = currentScan();
  const age = scanClock() - scan.at;
  if (exploring && age >= 0 && age < scanSweep) {
    const radius = (age / scanSweep) * detectorRange;
    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = colours.amber;
    ctx.globalAlpha = 0.9 * (1 - age / scanSweep);
    ctx.beginPath();
    for (let i = 0; i <= edgeSteps; i++) {
      const angle = (i / edgeSteps) * Math.PI * 2;
      const [x, y] = project(
        view,
        scan.from[0] + Math.cos(angle) * radius,
        scan.from[1],
        scan.from[2] + Math.sin(angle) * radius
      );
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Planned route, with how far along it the camera is; the course a
  // hovered link would take, marching towards its station; or in free roam
  // the autopilot's course, marching towards its goal
  const preview = exploring ? '' : previewed();
  const marching = !!preview || !!goal;
  const path = exploring
    ? goal
      ? worldStore.autopilotPath
      : null
    : flight.active
      ? flight.path
      : preview
        ? worldStore.previewPath
        : null;
  if (path?.length) {
    const route: [number, number][] = [];
    for (let i = 0; i < path.length; i += 3) {
      const [x, y] = project(view, path[i], path[i + 1], path[i + 2]);
      route.push([x, y]);
    }
    ctx.save();
    ctx.setLineDash([3, 4]);
    if (marching) ctx.lineDashOffset = still ? 0 : -(now / 60) % 7;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = marching ? colours.pink : colours.cyan;
    ctx.globalAlpha = marching ? 0.9 : 0.8;
    ctx.beginPath();
    route.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  }

  // Stations, far to near, each on a stalk down to the grid
  const target = exploring ? (goal?.station ?? '') : flight.active ? flight.to : preview;
  const stations = navigableStations
    .map((key) => {
      const [x, y, z] = stationPositions[key];
      return { key, top: project(view, x, y, z), foot: project(view, x, groundY, z) };
    })
    .sort((a, b) => a.top[2] - b.top[2]);
  ctx.font = `500 8.5px ${font}`;
  ctx.textBaseline = 'middle';
  const placed: Box[] = [];
  const crowded = view.scale < fitScale * crowdedBelow;
  for (const { key, top, foot } of stations) {
    const isTarget = key === target;
    stalk(ctx, top, foot, isTarget ? colours.pink : colours.violet, 0.45);
    ctx.strokeStyle = isTarget ? colours.pink : colours.violet;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(foot[0], foot[1], 3, 1.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (isTarget) pulse(ctx, top[0], top[1], colours.pink, now, still);
    ctx.fillStyle = isTarget ? colours.pink : colours.violet;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(top[0], top[1], isTarget ? 3.6 : 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Zoomed far out the stations bunch up: only the destination keeps its name
    if (crowded && !isTarget) continue;
    ctx.fillStyle = isTarget ? colours.text : colours.muted;
    const label = stationNames[key as StationKey].page.toUpperCase();
    const box = placeLabel(label, top[0], top[1], ctx.measureText(label).width, placed);
    ctx.textAlign = 'left';
    ctx.fillText(label, box.x, box.y + box.h / 2);
  }

  // Free roam's finds: hollow rings where each signal was logged (the comet
  // where it has flown on to), and the derelict as the craft it is; and the
  // contacts scans have picked out, amber
  for (const { signal, at, found } of plots) {
    const top = project(view, at[0], at[1], at[2]);
    const foot = project(view, at[0], groundY, at[2]);
    const isGoal = !!goal && worldStore.autopilot === `signal:${signal.id}`;
    stalk(ctx, top, foot, found ? colours.cyan : colours.amber, 0.3);
    if (isGoal) pulse(ctx, top[0], top[1], colours.pink, now, still);
    if (!found) {
      ctx.fillStyle = colours.amber;
      ctx.shadowColor = colours.amber;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(top[0], top[1], 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      continue;
    }
    if (signal.id === 'derelict') {
      ctx.fillStyle = colours.muted;
      ctx.beginPath();
      ctx.arc(top[0], top[1], 2.6, 0, Math.PI * 2);
      ctx.fill();
      if (crowded && !isGoal) continue;
      const label = stationNames.lost.craft.toUpperCase();
      const box = placeLabel(label, top[0], top[1], ctx.measureText(label).width, placed);
      ctx.textAlign = 'left';
      ctx.fillText(label, box.x, box.y + box.h / 2);
      continue;
    }
    ctx.strokeStyle = isGoal ? colours.pink : colours.cyan;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(top[0], top[1], 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // The camera: an arrow at its position, pointing the way it looks. Off the
  // map (free roam outran the zoom) it is held at the map's edge, hollow
  const eye = project(view, camera.x, camera.y, camera.z);
  const ahead = project(
    view,
    camera.x + camera.fx * 20,
    camera.y + camera.fy * 20,
    camera.z + camera.fz * 20
  );
  const ex = Math.min(Math.max(eye[0], 7), width - 7);
  const ey = Math.min(Math.max(eye[1], 7), height - 7);
  const held = ex !== eye[0] || ey !== eye[1];
  const angle = Math.atan2(ahead[0] - eye[0], -(ahead[1] - eye[1]));
  const below = project(view, camera.x, groundY, camera.z);
  if (!held) {
    stalk(
      ctx,
      [ex, ey],
      [Math.min(Math.max(below[0], 7), width - 7), Math.min(Math.max(below[1], 4), height - 4)],
      colours.cyan,
      0.35
    );
  }
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(angle);
  ctx.fillStyle = colours.cyan;
  ctx.strokeStyle = colours.cyan;
  ctx.shadowColor = colours.cyan;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  if (held) ctx.stroke();
  else ctx.fill();
  ctx.restore();

  // Scale bar
  const scaleBar = scaleBarFor(view.scale);
  const barLength = scaleBar * view.scale;
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
  const barText = `${scaleBar} ${unit}`;
  ctx.fillText(barText, bx - 5, by - 1);

  // Distance left to the destination: a station, or in free roam the course's goal
  const destination = goal
    ? { at: goal.at, label: `→ ${goal.label.toUpperCase()}` }
    : target
      ? {
          at: stationPositions[target as StationKey],
          label: `${preview ? 'Course ' : ''}→ ${stationNames[target as StationKey].page.toUpperCase()}`,
        }
      : null;
  if (destination) {
    const [tx, ty, tz] = destination.at;
    // A station flight counts down as the header's lock and the station
    // readout do (rangeToGo); a free-roam goal or a previewed route reads
    // the straight-line distance, with no flight to count down
    const toGo = !goal && !preview && flight.active ? rangeToGo() : null;
    const km =
      toGo && toGo.to === target
        ? toGo.km
        : Math.round(Math.hypot(tx - camera.x, ty - camera.y, tz - camera.z));
    const left = `${km} ${unit}`;
    const labelWidth = ctx.measureText(destination.label).width;
    // A long name goes up a line rather than run into the scale bar
    const room = bx - 5 - ctx.measureText(barText).width - 6;
    const ly = 14 + labelWidth + ctx.measureText(left).width > room ? by - 12 : by - 1;
    ctx.textAlign = 'left';
    ctx.fillStyle = colours.text;
    ctx.fillText(destination.label, 8, ly);
    ctx.fillStyle = colours.cyan;
    ctx.fillText(left, 14 + labelWidth, ly);
  }
}

/**
 * Whether the map is up for the camera's flight: on the way to a new page,
 * until its final approach brings the page's copy in. Not for a flight the
 * page's copy is already showing over (the warp in as the site loads, or as
 * the world is switched back on), whose copy it would cover. A page coming
 * back from the tour or free roam is hidden until the camera is home
 * (html[data-world-mode='returning']), so that flight has it too. The tour
 * and free roam have it throughout
 */
function flying() {
  if (worldMode.get().mode !== 'page') return true;
  const { active, approached, to } = worldStore.flight;
  if (!active || approached) return false;
  return copyHeldFor() === to || document.documentElement.dataset.worldMode !== 'page';
}

/**
 * The element with keyboard focus, when it is a control the map could
 * cover: not the page, the body, a whole region (the free roam HUD takes
 * focus itself) or anything else that covers much of the screen
 */
function focusedRect() {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || el === document.body) return null;
  if (el.matches('main, [role="region"], [role="dialog"]')) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  if (rect.width * rect.height > 0.25 * window.innerWidth * window.innerHeight) return null;
  return rect;
}

const coversFocus = (map: DOMRect) => {
  const focused = focusedRect();
  return (
    !!focused &&
    map.left < focused.right &&
    focused.left < map.right &&
    map.top < focused.bottom &&
    focused.top < map.bottom
  );
};

/**
 * A small 3D map of the world that appears while the camera flies to a new
 * page (and throughout tours and explore mode): every station at its true
 * position, the planned route, the destination and the camera itself.
 */
export function NavRadar() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // The range left on a flight comes from the course it is following
    watchCourse();
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!root || !canvas || !ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);

    let frame = 0;
    let frames = 0;
    let lastActive = -Infinity;
    let lastPreview = -Infinity;
    let covering = false;
    let colours = readColours(root);
    const zoom: Zoom = { scale: fitScale, at: 0 };
    // Wide layouts (app/page.scss): the copy keeps to the left, the station to the right
    const wide = window.matchMedia('(min-width: 900px) and (min-aspect-ratio: 11 / 10)');
    const font =
      getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono').trim() ||
      'ui-monospace, monospace';

    const tick = (now: number) => {
      const active = flying();
      if (active) lastActive = now;
      // A preview opens it only where it is clear of the page's copy: under
      // the header beside the station on a wide layout (a stacked one has the
      // copy there). It stays there if the course is then flown
      if (previewed() && wide.matches) lastPreview = now;
      const show = now - lastActive < linger || now - lastPreview < previewLinger;
      if (!root.classList.contains('nav-radar--on'))
        root.classList.toggle('nav-radar--aside', !active && now - lastPreview < previewLinger);
      root.classList.toggle('nav-radar--on', show);
      if (!show) {
        frame = 0;
        covering = false;
        root.classList.remove('nav-radar--clear');
        return;
      }
      // Out of the way of whatever has keyboard focus (a link the preview is
      // for, a tour control, a HUD button), checked every few frames
      if (frames++ % focusEvery === 0) {
        const next = coversFocus(root.getBoundingClientRect());
        if (next !== covering) root.classList.toggle('nav-radar--clear', (covering = next));
      }
      paint(ctx, colours, font, now, motionLevel() !== 'full', zoom);
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      colours = readColours(root);
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const stopFlight = onFlight((event) => {
      if (event === 'start') start();
    });
    const stopMode = worldMode.subscribe(start);
    // The preview's path is planned on the camera's next frame: look then
    const stopPreview = onPreview(() => requestAnimationFrame(() => requestAnimationFrame(start)));
    // Focus moving onto something under the map moves it out of the way at once
    const onFocus = () => {
      if (frame) frames = 0;
    };
    document.addEventListener('focusin', onFocus);
    start();
    return () => {
      stopFlight();
      stopMode();
      stopPreview();
      document.removeEventListener('focusin', onFocus);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className="nav-radar" aria-hidden="true">
      <span className="nav-radar__title">Nav · sector map · to scale</span>
      <canvas ref={canvasRef} className="nav-radar__map" style={{ width, height }} />
    </div>
  );
}
