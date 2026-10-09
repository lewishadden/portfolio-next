'use client';

import { useEffect, useRef } from 'react';

import { stationKeys, stationNames } from 'components/World/routes';
import { emitCue, worldStore } from 'components/World/worldStore';

import { rangeToGo, watchCourse } from './course';

import type { StationKey } from 'components/World/routes';

import './HeaderHud.scss';

/* ------------------------------------------------------------------
   The header bar as a cockpit HUD (3D effects on): a hologram drawn by
   one shader in plain WebGL (no three.js, so the header stays light) on
   a canvas behind the bar's real links and buttons.

   - The hologram: a thin frame with corner brackets, a grid and scan
     lines on a deeper layer, a passing sweep, a rolling scan line, fine
     grain and a flicker, a glow spilling below the bar, and a projector
     beam fanning down onto it from above the screen, with dust in it.
   - Target lock: brackets hold the current page; on navigation they let
     go, travel along the bar in step with the camera's flight and snap
     shut on the new page with a flash and a ping.
   - Power on: the first time it shows, the frame draws out from the
     middle, the corners snap in, the grid flickers in and the links
     flicker on one by one.
   - Optics: colour fringes that grow as it swings, and the picture
     tears now and then at top speed.
   - Depth: the hologram sits a little behind the links (CSS 3D, scaled
     so it lines up exactly at rest) and its grid deeper still, so a tilt
     shows parallax.
   - Motion: it hangs in the cockpit, so during a flight between pages
     it moves with the world's camera, on loose springs: it trails behind
     turns and sideways drift, banks with them, dips as the camera climbs
     and is pushed back by acceleration, then comes exactly to rest.
     Scrolling and small camera moves leave it still.
   - Sound (when on): a hum while it's on screen, ticks and clicks, the
     lock and the power-up.

   Reduced motion holds it still, skips the power-on and the travel, and
   draws only when something changes.
   ------------------------------------------------------------------ */

const vertexShader = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision mediump float;
uniform vec2 uRes;
uniform float uDpr;
uniform vec2 uSize;
uniform float uMargin;
uniform float uTime;
uniform vec4 uHoverRect;
uniform float uAim;
uniform vec4 uLock;
uniform float uLockOpen;
uniform float uLockFlash;
uniform float uLockPing;
uniform vec3 uLine;
uniform vec3 uFillColour;
uniform float uFill;
uniform vec4 uRows[2];
uniform float uFloor;
uniform float uProgress;
uniform float uTicks[6];
uniform float uTickCount;
uniform float uReading;
uniform float uFlight;
uniform float uGlow;
uniform float uMotion;
uniform float uLineAlpha;
uniform float uBoot;
uniform float uSplit;
uniform float uTear;
uniform vec2 uTilt;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float rectDist(vec2 p, vec4 r) {
  vec2 c = r.xy + r.zw * 0.5;
  vec2 q = abs(p - c) - r.zw * 0.5;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

/** 1 inside a box, feathered to 0 a few pixels outside it */
float within(vec2 p, vec4 r) {
  return smoothstep(6.0, 0.0, rectDist(p, r));
}

/** Corner brackets round a box: its outline, only near the ends */
float brackets(vec2 p, vec4 g, float arm) {
  vec2 local = p - g.xy;
  float nearEnd = step(min(local.x, g.z - local.x), arm) * step(-0.5, min(local.x, g.z - local.x));
  return smoothstep(1.6, 0.4, abs(rectDist(p, g))) * nearEnd;
}

/** The hologram's light at a point (its lines, not its tint) */
float lines(vec2 p, float t) {
  float outside = rectDist(p, vec4(0.0, 0.0, uSize));
  float inside = step(outside, 0.0);
  float edge = -outside;

  // Powering on: the top and bottom draw out from the middle, then the
  // sides and corners snap in, then the rest flickers in
  float reach = uSize.x * 0.5 * smoothstep(0.0, 0.35, uBoot);
  float fromMiddle = abs(p.x - uSize.x * 0.5);
  float drawn = step(fromMiddle, reach + 0.5);
  float onEdge = smoothstep(4.0, 0.0, min(abs(p.y), abs(p.y - uSize.y)));
  float tip = exp(-pow((fromMiddle - reach) / 5.0, 2.0)) * onEdge * (1.0 - step(0.35, uBoot));
  float sides = smoothstep(0.3, 0.4, uBoot);
  float snap = exp(-pow((uBoot - 0.42) * 14.0, 2.0));
  float settle = smoothstep(0.4, 0.9, uBoot);
  float flickerIn = max(step(hash(vec2(floor(t * 30.0), 3.0)), settle * 1.2), step(1.0, uBoot));

  float frame = smoothstep(1.4, 0.2, abs(outside + 1.0));
  float topOrBottom = step(min(p.y, uSize.y - p.y), 3.0);
  frame *= mix(sides, drawn, topOrBottom);
  float nearCorner = step(min(p.x, uSize.x - p.x), 20.0) * step(min(p.y, uSize.y - p.y), 20.0);
  float bracket = nearCorner * smoothstep(3.4, 2.2, edge) * inside * sides;
  float halo = exp(-max(outside, 0.0) / 5.0) * (1.0 - inside) * uGlow * sides;
  // A glow spilling below the bar, as if it lit the air under it
  float below = max(p.y - uSize.y, 0.0);
  float spill = exp(-below / 9.0) * step(uSize.y, p.y) * smoothstep(0.0, 40.0, p.x) * smoothstep(uSize.x, uSize.x - 40.0, p.x) * 0.22 * uGlow * settle;

  // The grid and scan lines sit on a deeper layer, so they slide against the frame as it tilts
  vec2 deep = p + vec2(-uTilt.x, uTilt.y) * 1.6;
  float grid = (step(fract(deep.x / 12.0), 0.07) + step(fract(deep.y / 12.0), 0.07)) * 0.045 * inside;
  float scan = (0.5 + 0.5 * sin(deep.y * 1.7 - t * 9.0)) * 0.05 * inside;
  float sweep = exp(-pow((p.x / uSize.x - fract(t * 0.07)) * 12.0, 2.0)) * 0.08 * inside * uMotion;
  float roll = exp(-pow((p.y - (mod(-t * 26.0, uSize.y + 90.0) - 45.0)) / 2.2, 2.0)) * 0.3 * inside * uMotion;
  float grain = (hash(floor(p * 1.5) + floor(t * 24.0)) - 0.5) * 0.06 * inside * uMotion;
  float body = (grid + scan + sweep + roll + grain) * flickerIn;

  float light = frame * 0.5 + tip * 1.4 + bracket * (0.95 + snap * 1.4) + halo * (0.12 + nearCorner * 0.3) + spill + body;

  // What you point at (or focus): lit
  light += smoothstep(1.0, -1.0, rectDist(p, vec4(uHoverRect.xy - 5.0, uHoverRect.zw + 10.0))) * 0.16 * step(0.0, uHoverRect.z);
  // A link to another station: brackets half-close on it, aiming (the course is plotted)
  float aimOpen = mix(16.0, 7.0, uAim);
  vec4 aimBox = vec4(uHoverRect.xy - 5.0 - aimOpen, uHoverRect.zw + 10.0 + aimOpen * 2.0);
  light += brackets(p, aimBox, 6.0) * uAim * 0.75 * step(0.0, uHoverRect.z);

  // The target lock on the current page: brackets (wider while travelling,
  // bright as they lock) and an underline, and a ping going out on arrival
  float lockOn = smoothstep(0.75, 0.9, uBoot) * step(0.0, uLock.z);
  vec4 g = vec4(uLock.xy - 5.0 - uLockOpen, uLock.zw + 10.0 + uLockOpen * 2.0);
  light += lockOn * brackets(p, g, 8.0) * (1.1 + uLockFlash * 1.6);
  float span = step(uLock.x, p.x) * step(p.x, uLock.x + uLock.z);
  float baseline = uLock.y + uLock.w + 3.0;
  light += lockOn * span * (smoothstep(2.0, 0.0, abs(p.y - baseline)) * (0.9 + uLockFlash) + exp(-abs(p.y - baseline) / 4.0) * 0.25 * uGlow);
  vec4 ping = vec4(uLock.xy - 5.0 - uLockPing * 18.0, uLock.zw + 10.0 + uLockPing * 36.0);
  light += lockOn * smoothstep(1.4, 0.3, abs(rectDist(p, ping))) * (1.0 - uLockPing) * step(0.001, uLockPing) * 0.8;

  // Along the bottom edge, how far through the page you are: a 1px fill
  // with a bright head, and a tick at each of the page's sections, the one
  // being read glowing. In flight it's the course instead: the fill is how
  // far you've come and the rest runs on ahead, dashed (the ticks belong to
  // the page you left, so they fade)
  if (abs(p.y - uSize.y) < 9.0) {
    float edgeY = uSize.y - 1.0;
    float headX = uSize.x * clamp(uProgress, 0.0, 1.0);
    float onLine = smoothstep(1.3, 0.3, abs(p.y - edgeY)) * step(0.0, p.x) * step(p.x, uSize.x);
    float filled = onLine * step(p.x, headX) * 0.55;
    float ahead = onLine * step(headX, p.x) * step(0.5, fract(p.x / 7.0 - t * 1.2)) * 0.45 * uFlight;
    vec2 d = (p - vec2(headX, edgeY)) / vec2(6.0, 2.2);
    float head = exp(-dot(d, d)) * 1.3 * step(0.002, uProgress + uFlight);
    float ticks = 0.0;
    for (int i = 0; i < 6; i++) {
      if (float(i) >= uTickCount) break;
      float x = uTicks[i] * uSize.x;
      float mark = smoothstep(1.1, 0.3, abs(p.x - x)) * step(edgeY - 5.0, p.y) * step(p.y, edgeY + 0.5);
      float lit = 1.0 - min(abs(float(i) - uReading), 1.0);
      float glow = exp(-length(p - vec2(x, edgeY - 2.0)) / 4.0) * lit;
      ticks += mark * (0.45 + lit * 0.9) + glow * 0.6;
    }
    light += (filled + ahead + head + ticks * (1.0 - uFlight)) * settle;
  }
  return light;
}

void main() {
  // Bar-local CSS pixels, from its top left corner
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr - uMargin;
  float t = uTime * uMotion;

  // At top speed the picture tears now and then: bands knocked sideways
  float band = floor(p.y / 5.0);
  float tick = floor(t * 18.0);
  float torn = step(1.0 - uTear * 0.6, hash(vec2(band, tick))) * uTear;
  p.x += torn * (hash(vec2(band + 7.0, tick)) - 0.5) * 22.0;
  // Pointing at a link knocks a band sideways now and then too
  float jump = step(0.94, hash(vec2(floor(t * 14.0), 11.0))) * step(0.0, uHoverRect.z);
  p.x += jump * 5.0 * sin(p.y * 0.4);

  // Colour fringes, wider as it swings
  float aG = lines(p, t);
  float aR = aG;
  float aB = aG;
  if (uSplit > 0.01) {
    float k = 0.5 + uSplit * 3.5;
    aR = lines(p + vec2(k, 0.0), t);
    aB = lines(p - vec2(k, 0.0), t);
  }
  float flicker = 1.0 - uMotion * 0.1 * (0.5 + 0.5 * sin(t * 53.0) * sin(t * 17.0));
  float a = clamp(max(aG, max(aR, aB) * 0.75), 0.0, 1.0) * flicker;
  vec3 colour = (uLine * clamp(aG, 0.0, 1.0) + vec3(1.0, 0.3, 0.7) * max(aR - aG, 0.0) * 0.7 + vec3(0.35, 0.55, 1.0) * max(aB - aG, 0.0) * 0.7) * flicker;

  // The projector: rays fanning down from above the screen onto the bar,
  // with dust drifting through them
  vec2 emitter = vec2(uSize.x * 0.5, -90.0);
  vec2 ray = p - emitter;
  float slope = ray.x / max(ray.y, 1.0);
  float width = uSize.x * 0.5 / -emitter.y;
  float cone = (1.0 - smoothstep(0.82, 1.0, abs(slope) / width)) * step(0.0, ray.y) * step(p.y, uSize.y);
  float shafts = 0.55 + 0.45 * sin(atan(slope) * 70.0 + t * 0.4) * sin(atan(slope) * 23.0 - t * 0.25);
  float above = 1.0 - smoothstep(-uMargin, 4.0, p.y) * 0.65;
  float beam = cone * shafts * above * 0.07 * uGlow * smoothstep(0.5, 1.0, uBoot);
  vec2 dustCell = vec2(slope * 26.0, (ray.y - t * 7.0) / 9.0);
  vec2 dustId = floor(dustCell);
  vec2 dustAt = fract(dustCell) - 0.5 - (vec2(hash(dustId + 1.3), hash(dustId + 8.1)) - 0.5) * 0.6;
  float dust = smoothstep(0.16, 0.0, length(dustAt * vec2(1.0, 2.0))) * step(0.9, hash(dustId)) * cone
    * (0.5 + 0.5 * sin(t * 2.0 + hash(dustId + 4.0) * 30.0)) * 0.35 * uGlow * uMotion;
  colour += uLine * (beam + dust);
  float glowAlpha = (beam + dust) * 0.4;

  // A see-through tint, thickest along the row of links, with a faint
  // interference ripple through it
  float inside = step(rectDist(p, vec4(0.0, 0.0, uSize)), 0.0);
  float row = 0.5 + 0.5 * exp(-pow((p.y - uSize.y * 0.5) / (uSize.y * 0.3), 2.0));
  float ripple = 0.92 + 0.08 * sin(p.y * 0.9 + p.x * 0.05 - t * 3.0);
  // Never thinner than uFloor over the row of links and buttons themselves,
  // so a lit hull or the hero's name behind the bar can't swallow them
  float targets = max(within(p, uRows[0]), within(p, uRows[1]));
  float fill = max(uFill * row * ripple, uFloor * targets) * inside * smoothstep(0.35, 0.8, uBoot);
  // Premultiplied; with uLineAlpha under 1 the lines add light to what's behind
  gl_FragColor = vec4(colour + uFillColour * fill * (1.0 - a), a * uLineAlpha + glowAlpha + fill * (1.0 - a));
}
`;

/** Room round the bar for its glow, its spill and its sway (CSS px; keep in step with HeaderHud.scss) */
export const hudMargin = 30;
/** How long the power-on takes (s) */
const bootTime = 1.6;

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * The hologram per theme. It's see-through: `clear` is its tint over open
 * space and `dense` once the page is under it (thickest along the row of
 * links, so they stay readable; no backdrop blur, which is costly under a
 * bar that moves every frame and glitched on Android). `floor` is the least
 * it ever is over the links and buttons themselves, so a lit hull or the
 * hero's name behind the bar never swallows them. `lineAlpha` below 1
 * makes its lines add light to what's behind, like a projection
 */
const palettes = {
  dark: {
    line: rgb('#5ee7fa'),
    fill: rgb('#05091a'),
    clear: 0.05,
    dense: 0.78,
    floor: 0.6,
    glow: 1,
    lineAlpha: 0.55,
  },
  light: {
    line: rgb('#0e7490'),
    fill: rgb('#f2f6fc'),
    clear: 0.08,
    dense: 0.84,
    floor: 0.72,
    glow: 0.45,
    lineAlpha: 1,
  },
};
export type HudTheme = keyof typeof palettes;

type Box = [number, number, number, number];
const none: Box = [-999, -999, -1, -1];

/** One frame's worth of what the hologram shows */
interface Frame {
  time: number;
  theme: HudTheme;
  fill: number;
  motion: number;
  hover: Box;
  /** The row of links and the row of buttons (each one box round them all), as 8 floats */
  rows: Float32Array;
  /** 0..1 along the bottom edge: how far through the page, or through the flight */
  progress: number;
  ticks: Ticks;
  /** 0..1: how much the bottom edge shows the flight's course rather than the page */
  flight: number;
  /** 0..1: how far the brackets have closed on a hovered link to another station */
  aim: number;
  lock: Box;
  lockOpen: number;
  lockFlash: number;
  lockPing: number;
  boot: number;
  split: number;
  tear: number;
  tilt: [number, number];
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

const uniformNames = [
  'uRes',
  'uDpr',
  'uSize',
  'uMargin',
  'uTime',
  'uHoverRect',
  'uAim',
  'uLock',
  'uLockOpen',
  'uLockFlash',
  'uLockPing',
  'uLine',
  'uFillColour',
  'uFill',
  'uRows',
  'uFloor',
  'uProgress',
  'uTicks',
  'uTickCount',
  'uReading',
  'uFlight',
  'uGlow',
  'uMotion',
  'uLineAlpha',
  'uBoot',
  'uSplit',
  'uTear',
  'uTilt',
] as const;
type Uniforms = Record<(typeof uniformNames)[number], WebGLUniformLocation | null>;

/**
 * Compiles and links the HUD's program, with the full-screen triangle, and
 * reads its uniform locations from that program: locations belong to the
 * program they came from, so they are read afresh with every one linked
 */
function link(gl: WebGLRenderingContext) {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries(
    uniformNames.map((name) => [name, gl.getUniformLocation(program, name)])
  ) as Uniforms;
  return { program, u };
}

/** Sets up the shader on a canvas; null where WebGL can't start */
function createHud(canvas: HTMLCanvasElement, onLost: () => void) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl || gl.isContextLost()) return null;
  const linked = link(gl);
  if (!linked) return null;
  const { program, u } = linked;
  /**
   * Set once this instance is done with. React runs effects twice in
   * development on the same canvas, so the same context: the second run
   * links a program of its own, and anything the first run left waiting (a
   * fonts.ready re-measure) would set this program's uniforms with the
   * other one in use (INVALID_OPERATION). A disposed instance touches
   * nothing
   */
  let disposed = false;

  const lost = (e: Event) => {
    e.preventDefault();
    onLost();
  };
  canvas.addEventListener('webglcontextlost', lost);

  return {
    resize(width: number, height: number, dpr: number) {
      if (disposed) return;
      const w = Math.round((width + hudMargin * 2) * dpr);
      const h = Math.round((height + hudMargin * 2) * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.useProgram(program);
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uDpr, dpr);
      gl.uniform2f(u.uSize, width, height);
      gl.uniform1f(u.uMargin, hudMargin);
    },
    draw(f: Frame) {
      if (disposed) return;
      const palette = palettes[f.theme];
      gl.useProgram(program);
      gl.uniform1f(u.uTime, f.time);
      gl.uniform4fv(u.uHoverRect, f.hover);
      gl.uniform1f(u.uAim, f.aim);
      gl.uniform4fv(u.uLock, f.lock);
      gl.uniform1f(u.uLockOpen, f.lockOpen);
      gl.uniform1f(u.uLockFlash, f.lockFlash);
      gl.uniform1f(u.uLockPing, f.lockPing);
      gl.uniform3fv(u.uLine, palette.line);
      gl.uniform3fv(u.uFillColour, palette.fill);
      gl.uniform1f(u.uFill, palette.clear + (palette.dense - palette.clear) * f.fill);
      gl.uniform4fv(u.uRows, f.rows);
      gl.uniform1f(u.uFloor, palette.floor);
      gl.uniform1f(u.uProgress, f.progress);
      gl.uniform1fv(u.uTicks, f.ticks.at);
      gl.uniform1f(u.uTickCount, f.ticks.count);
      gl.uniform1f(u.uReading, f.ticks.reading);
      gl.uniform1f(u.uFlight, f.flight);
      gl.uniform1f(u.uGlow, palette.glow);
      gl.uniform1f(u.uMotion, f.motion);
      gl.uniform1f(u.uLineAlpha, palette.lineAlpha);
      gl.uniform1f(u.uBoot, f.boot);
      gl.uniform1f(u.uSplit, f.split);
      gl.uniform1f(u.uTear, f.tear);
      gl.uniform2f(u.uTilt, f.tilt[0], f.tilt[1]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    // The context goes with the canvas; losing it here would break a remount
    // that reuses the canvas (React runs effects twice in development)
    dispose() {
      disposed = true;
      canvas.removeEventListener('webglcontextlost', lost);
      gl.deleteProgram(program);
    },
  };
}

/** A box relative to the bar's border box, ignoring the bar's own transform */
function boxIn(node: HTMLElement, bar: HTMLElement): Box {
  let x = bar.clientLeft;
  let y = bar.clientTop;
  let n: HTMLElement | null = node;
  while (n && n !== bar) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return [x, y, node.offsetWidth, node.offsetHeight];
}

/** One box round all of these (none for none) */
function around(list: Box[]): Box {
  if (!list.length) return none;
  const x0 = Math.min(...list.map((b) => b[0]));
  const y0 = Math.min(...list.map((b) => b[1]));
  const x1 = Math.max(...list.map((b) => b[0] + b[2]));
  const y1 = Math.max(...list.map((b) => b[1] + b[3]));
  return [x0, y0, x1 - x0, y1 - y0];
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smootherstep = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------- The target lock ---------- */

interface Lock {
  /** Which target it holds, -1 for none */
  index: number;
  /** Where it's drawn now, and where a move set off from and is going */
  at: Box;
  from: Box;
  to: Box;
  travelling: boolean;
  /** When the move began, whether the camera's flight has been seen, and when it locked (s) */
  startedAt: number;
  flightSeen: boolean;
  lockedAt: number;
}

const createLock = (): Lock => ({
  index: -1,
  at: [...none],
  from: [...none],
  to: [...none],
  travelling: false,
  startedAt: 0,
  flightSeen: false,
  lockedAt: -10,
});

/** The current page is `index` at `box`: hold it, or set off for it */
function aimLock(lock: Lock, index: number, box: Box, now: number, still: boolean) {
  if (index < 0) {
    lock.index = -1;
    lock.travelling = false;
    lock.at = [...none];
    return;
  }
  if (index === lock.index && !lock.travelling) {
    lock.at = box;
    return;
  }
  if (index === lock.index) {
    lock.to = box;
    return;
  }
  const first = lock.index < 0;
  lock.index = index;
  lock.to = box;
  if (first || still) {
    lock.at = box;
    lock.travelling = false;
    if (!first) lock.lockedAt = now;
    return;
  }
  lock.from = [...lock.at];
  lock.travelling = true;
  lock.startedAt = now;
  lock.flightSeen = false;
}

/** Moves the lock along: in step with the camera's flight, or on its own if there's none */
function stepLock(lock: Lock, now: number) {
  if (!lock.travelling) return 0;
  const { flight } = worldStore;
  let progress: number;
  if (flight.active) {
    lock.flightSeen = true;
    progress = smootherstep(flight.progress);
  } else if (lock.flightSeen) {
    progress = 1;
  } else {
    progress = smootherstep((now - lock.startedAt - 0.25) / 0.6);
  }
  lock.at = lock.from.map((v, i) => mix(v, lock.to[i], progress)) as Box;
  if (progress >= 1) {
    lock.at = lock.to;
    lock.travelling = false;
    lock.lockedAt = now;
    emitCue('hud-lock');
    return 0;
  }
  // Open wider mid-way, as if it had let go
  return Math.sin(progress * Math.PI) * 8;
}

/* ---------- How the HUD moves with the camera ---------- */

/** One axis of the HUD's motion: where it is and how fast it's going */
interface Axis {
  at: number;
  speed: number;
}

interface Sway {
  primed: boolean;
  /** 0..1: how much it's following the camera (only during flights, eased in and out) */
  flying: number;
  camera: { x: number; y: number; z: number; heading: number; pitch: number; ahead: number };
  /** Offsets (px) and turns (degrees), each on its own spring */
  x: Axis;
  y: Axis;
  z: Axis;
  roll: Axis;
  rx: Axis;
  ry: Axis;
  /**
   * A jolt from the camera's shake (worldStore.shake: the rocket's launch),
   * on top of the springs: px, and degrees of roll; `burst` (0..1) is how
   * hard the picture splits and tears as a shake hits, dying away fast,
   * and `last` the shake seen the frame before
   */
  jolt: { x: number; y: number; roll: number; burst: number; last: number };
}

const axis = (): Axis => ({ at: 0, speed: 0 });
const createSway = (): Sway => ({
  primed: false,
  flying: 0,
  camera: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, ahead: 0 },
  x: axis(),
  y: axis(),
  z: axis(),
  roll: axis(),
  rx: axis(),
  ry: axis(),
  jolt: { x: 0, y: 0, roll: 0, burst: 0, last: 0 },
});

/**
 * A loose spring towards `target`: it overshoots and wobbles a little, like
 * a projection settling, then comes exactly to rest (so the bar is still,
 * and its links easy to click, whenever the camera is)
 */
function spring(a: Axis, target: number, dt: number) {
  a.speed += ((target - a.at) * 38 - a.speed * 7.5) * dt;
  a.at += a.speed * dt;
  if (Math.abs(target - a.at) < 0.005 && Math.abs(a.speed) < 0.01) {
    a.at = target;
    a.speed = 0;
  }
}

/**
 * One frame of sway, from the camera alone (worldStore, written by the
 * world every frame), and only during a flight between pages: then it
 * trails behind turns and sideways drift, banking with them, dips as the
 * camera climbs and is pushed back as it speeds up. Scrolling and small
 * camera moves leave it alone (the header is something you read and click;
 * the flight is when you're watching). Springs bring it home; it then holds
 * still
 */
function stepSway(s: Sway, dt: number, t: number, hold: boolean) {
  const cam = worldStore.camera;
  const pitch = Math.asin(clamp(cam.fy, -1, 1));
  const last = s.camera;
  // A jump (a new page with reduced motion, a long pause) is not motion
  const jumped = Math.hypot(cam.x - last.x, cam.y - last.y, cam.z - last.z) > 400 * dt + 5;
  let lateral = 0;
  let vertical = 0;
  let yawRate = 0;
  let pitchRate = 0;
  let surge = 0;
  if (s.primed && !jumped && dt > 0) {
    const vx = (cam.x - last.x) / dt;
    const vy = (cam.y - last.y) / dt;
    const vz = (cam.z - last.z) / dt;
    // In the camera's view: right is (cos h, 0, sin h), ahead is its forward vector
    lateral = vx * Math.cos(cam.heading) + vz * Math.sin(cam.heading);
    vertical = vy;
    yawRate = wrap(cam.heading - last.heading) / dt;
    pitchRate = (pitch - last.pitch) / dt;
    const ahead = vx * cam.fx + vy * cam.fy + vz * cam.fz;
    // Smoothed, so frame-to-frame jitter isn't read as acceleration
    const smoothed = last.ahead + (ahead - last.ahead) * (1 - Math.exp(-8 * dt));
    surge = (smoothed - last.ahead) / dt;
    last.ahead = smoothed;
  }
  s.primed = true;
  last.x = cam.x;
  last.y = cam.y;
  last.z = cam.z;
  last.heading = cam.heading;
  last.pitch = pitch;

  // Held still while the loading screen's mark flies into the logo slot
  // (the warp in is a flight): it eases in once the screen has gone
  const following = worldStore.flight.active && !hold;
  s.flying += (Number(following) - s.flying) * (1 - Math.exp(-5 * dt));
  if (s.flying < 0.001) s.flying = 0;
  const f = s.flying;
  const shake = clamp(worldStore.velocity / 180, 0, 1) * f;
  spring(
    s.x,
    clamp(lateral * 0.11 + yawRate * 15, -15, 15) * f + Math.sin(t * 31) * shake * 0.6,
    dt
  );
  spring(
    s.y,
    clamp(vertical * 0.09 + pitchRate * 12, -9, 9) * f + Math.cos(t * 27) * shake * 0.45,
    dt
  );
  // Pushed back by acceleration, and sitting a little further off at speed
  spring(s.z, clamp(-surge * 0.1 - worldStore.velocity * 0.06, -40, 18) * f, dt);
  spring(s.roll, clamp(yawRate * 2.5 + lateral * 0.01, -2.5, 2.5) * f, dt);
  // Only a hint of 3D twist: tilted text renders soft
  spring(s.ry, clamp(yawRate * 1.5, -2, 2) * f, dt);
  spring(s.rx, clamp(pitchRate * 1.5, -1.5, 1.5) * f, dt);

  // The camera's shake knocks it about directly, flight or not: at most
  // 3px and 1° of roll, jittering faster than the springs could follow.
  // As a shake hits, the picture splits and tears in a short burst
  const jolt = clamp(worldStore.shake, 0, 1);
  s.jolt.x = (Math.sin(t * 53.1) * 0.6 + Math.sin(t * 31.7) * 0.4) * 3 * jolt;
  s.jolt.y = (Math.cos(t * 47.3) * 0.6 + Math.sin(t * 23.9) * 0.4) * 2 * jolt;
  s.jolt.roll = (Math.sin(t * 39.4) * 0.7 + Math.cos(t * 17.2) * 0.3) * jolt;
  s.jolt.burst = Math.max(s.jolt.burst * Math.exp(-5 * dt), jolt - s.jolt.last > 0.15 ? jolt : 0);
  if (s.jolt.burst < 0.01) s.jolt.burst = 0;
  s.jolt.last = jolt;
}

const swayTransform = ({ x, y, z, roll, rx, ry, jolt }: Sway) =>
  `perspective(900px) translate3d(${(x.at + jolt.x).toFixed(2)}px, ${(y.at + jolt.y).toFixed(2)}px, ${z.at.toFixed(2)}px) rotate(${(roll.at + jolt.roll).toFixed(3)}deg) rotateX(${rx.at.toFixed(3)}deg) rotateY(${ry.at.toFixed(3)}deg)`;

/** How hard it's swinging, 0..1: colour fringes and the hum follow it */
const swing = (s: Sway) =>
  clamp(
    (Math.abs(s.x.speed) + Math.abs(s.y.speed) + Math.abs(s.z.speed) * 0.5) / 260 +
      Math.abs(s.roll.speed) / 30,
    0,
    1
  );

/* ---------- Progress along the bottom edge ---------- */

/** At most this many section ticks (the shader's uTicks) */
const maxTicks = 6;
/** Where a section counts as being read: the world's reading line (pageInputs) */
const readingLine = 0.45;

/**
 * The page's sections as ticks along the bar: `at` is how far through the
 * page (0..1 of its scroll) each one reaches the reading line, `reading`
 * the one being read (-1 for none)
 */
interface Ticks {
  at: Float32Array;
  count: number;
  reading: number;
}

/**
 * What a page's sections are: the parts the camera moves round
 * ([data-world-section]), the skills categories and the experience roles.
 * Scoped to the page itself (the outgoing page's copy keeps its classes)
 */
const sectionSelector =
  '#main-content :is([data-world-section], [data-world-category], [data-world-target^="role:"])';

/** Measures where the page's sections fall (up to six, spread evenly over more) */
function measureTicks(ticks: Ticks) {
  const sections = [...document.querySelectorAll<HTMLElement>(sectionSelector)];
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const picked =
    sections.length <= maxTicks
      ? sections
      : Array.from(
          { length: maxTicks },
          (_, i) => sections[Math.round((i * (sections.length - 1)) / (maxTicks - 1))]
        );
  ticks.count = scrollable > 0 ? picked.length : 0;
  ticks.at.fill(0);
  picked.forEach((el, i) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    ticks.at[i] = clamp((top - window.innerHeight * readingLine) / scrollable, 0, 1);
  });
}

/** The section being read at `progress`: the last tick reached */
function readingAt(ticks: Ticks, progress: number) {
  let reading = -1;
  for (let i = 0; i < ticks.count; i++) if (ticks.at[i] <= progress + 0.002) reading = i;
  return reading;
}

const isStation = (key: string): key is StationKey => stationKeys.includes(key as StationKey);

/** What the label riding the travelling lock says: where to, and how far still to go */
const courseLabel = (to: StationKey, km: number) =>
  `→ ${stationNames[to].page.toUpperCase()} · ${km} KM`;

/** What the loop reads from React, handed over through a ref */
interface HudProps {
  theme: HudTheme;
  dense: boolean;
  still: boolean;
}

/**
 * The HUD's canvas, inside the header bar (it frames the bar's own links
 * and buttons, so it measures them). Reports whether it could start, so
 * the header can switch to its HUD styles, or keep its flat bar
 */
export function HeaderHud({
  theme,
  dense,
  still,
  onLive,
}: HudProps & { onLive: (live: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const courseRef = useRef<HTMLSpanElement>(null);
  const props = useRef<HudProps>({ theme, dense, still });
  /** Set when something the hologram shows has changed (drawing on demand for reduced motion) */
  const dirty = useRef(true);

  useEffect(() => {
    props.current = { theme, dense, still };
    dirty.current = true;
  }, [theme, dense, still]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const bar = canvas?.parentElement;
    if (!canvas || !bar) return;
    let failed = false;
    const hud = createHud(canvas, () => {
      failed = true;
      onLive(false);
    });
    if (!hud) {
      onLive(false);
      return;
    }
    onLive(true);

    const header = bar.closest('header');
    const root = document.documentElement;
    let elements: HTMLElement[] = [];
    let boxes: Box[] = [];
    /** One box round the links and one round the buttons, for the fill's floor */
    const rows = new Float32Array([...none, ...none]);
    let hover = -1;
    let fill = props.current.dense ? 1 : 0;
    const ticks: Ticks = { at: new Float32Array(maxTicks), count: 0, reading: -1 };
    let progress = 0;
    /** 0..1: how much the bottom edge shows the flight's course, eased */
    let flightBlend = 0;
    watchCourse();
    const label = courseRef.current;
    let labelText = '';
    const sway = createSway();
    const lock = createLock();
    /** When the power-on began (s), -1 until the HUD is first in sight */
    let bootAt = -1;
    let bootTimer = 0;
    const seconds = () => performance.now() / 1000;

    const measure = () => {
      elements = [...bar.querySelectorAll<HTMLElement>('.header__link, .header__actions > *')];
      boxes = elements.map((el) => (el.offsetParent ? boxIn(el, bar) : [...none]));
      // The links and buttons flicker on in this order when it powers on
      [bar.querySelector<HTMLElement>('.header__logo'), ...elements].forEach((el, i) =>
        el?.style.setProperty('--hud-i', String(i))
      );
      const isLink = elements.map((el) => el.classList.contains('header__link'));
      rows.set(around(boxes.filter((box, i) => isLink[i] && box[2] > 0)), 0);
      rows.set(around(boxes.filter((box, i) => !isLink[i] && box[2] > 0)), 4);
      const active = elements.findIndex((el) => el.getAttribute('aria-current') === 'page');
      aimLock(lock, active, active >= 0 ? boxes[active] : none, seconds(), props.current.still);
      hud.resize(bar.offsetWidth, bar.offsetHeight, Math.min(window.devicePixelRatio || 1, 2));
      measureTicks(ticks);
      dirty.current = true;
    };
    // The page's sections move as it lays out, loads and reveals: measured
    // again whenever the page changes size (a new page included), and once
    // its entrance has settled
    const main = document.getElementById('main-content');
    let tickTimer = 0;
    const remeasureTicks = () => {
      measureTicks(ticks);
      dirty.current = true;
      window.clearTimeout(tickTimer);
      tickTimer = window.setTimeout(() => {
        measureTicks(ticks);
        dirty.current = true;
      }, 1200);
    };
    const pageSize = new ResizeObserver(remeasureTicks);
    if (main) pageSize.observe(main);

    // What you point at (or focus), by delegation; ticks and clicks for the sound
    const targetOf = (node: EventTarget | null) =>
      node instanceof Node ? elements.findIndex((el) => el.contains(node)) : -1;
    const over = (e: Event) => {
      const next = targetOf(e.target);
      if (next >= 0 && next !== hover) emitCue('hud-hover');
      hover = next;
      dirty.current = true;
    };
    const out = (e: PointerEvent | FocusEvent) => {
      if (targetOf(e.relatedTarget) < 0) hover = -1;
      dirty.current = true;
    };
    const click = (e: Event) => {
      if (targetOf(e.target) >= 0) emitCue('hud-click');
    };
    bar.addEventListener('pointerover', over);
    bar.addEventListener('pointerout', out);
    bar.addEventListener('focusin', over);
    bar.addEventListener('focusout', out);
    bar.addEventListener('click', click);

    measure();
    // Anything that moves what it frames: the bar resizing, a link or
    // button resizing (fonts loading, the header's HUD styles arriving)
    const resize = new ResizeObserver(measure);
    resize.observe(bar);
    elements.forEach((el) => resize.observe(el));
    // The current page changes with navigation; the header's look with its class
    const mutations = new MutationObserver(measure);
    mutations.observe(bar, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
    if (header) mutations.observe(header, { attributes: true, attributeFilter: ['class'] });
    document.fonts?.ready.then(measure);

    /**
     * Nothing to draw while the header is out of sight: tour, free roam,
     * the loading screen while it covers the page. As it lifts the HUD
     * powers on, under the mark flying into its logo slot
     */
    const away = () =>
      (root.dataset.worldMode !== undefined && root.dataset.worldMode !== 'page') ||
      root.dataset.boot === 'loading';

    /** Shows the course label under the lock's box ('' hides it) */
    const showLabel = (text: string, box?: Box) => {
      if (!label) return;
      if (text !== labelText) {
        labelText = text;
        label.textContent = text;
        label.hidden = !text;
      }
      if (text && box) {
        label.style.transform = `translate3d(${(box[0] + box[2] / 2).toFixed(1)}px, ${(box[1] + box[3] + 9).toFixed(1)}px, 0) translateX(-50%)`;
      }
    };

    let frame = 0;
    let last = performance.now();
    let odd = false;
    let aim = 0;
    const loop = (nowMs: number) => {
      frame = requestAnimationFrame(loop);
      if (failed) return;
      const dt = Math.min((nowMs - last) / 1000, 0.1);
      last = nowMs;
      if (away()) {
        worldStore.hudHum = 0;
        dirty.current = true;
        showLabel('');
        return;
      }
      const now = nowMs / 1000;
      const { theme: hudTheme, dense: thick, still: calm } = props.current;
      // Power on the first time it's in sight (all at once for reduced motion)
      if (bootAt < 0) {
        bootAt = calm ? now - bootTime : now;
        if (!calm) {
          emitCue('hud-boot');
          if (header) {
            // Powering on under the loading screen's mark as it docks: the
            // logo arrives with the mark rather than flickering on
            header.dataset.hudBoot = root.dataset.boot === 'leaving' ? 'docked' : '';
            bootTimer = window.setTimeout(
              () => delete header.dataset.hudBoot,
              bootTime * 1000 + 700
            );
          }
        }
      }
      const boot = clamp((now - bootAt) / bootTime, 0, 1);
      const target = thick ? 1 : 0;
      const sinceLock = now - lock.lockedAt;
      const hoverBox = hover >= 0 && boxes[hover] ? boxes[hover] : none;
      const scrolled = clamp(worldStore.scroll, 0, 1);

      if (calm) {
        showLabel('');
        if (Math.abs(scrolled - progress) > 0.0005) {
          progress = scrolled;
          dirty.current = true;
        }
        const reading = readingAt(ticks, progress);
        if (reading !== ticks.reading) {
          ticks.reading = reading;
          dirty.current = true;
        }
        if (bar.style.transform) bar.style.transform = '';
        if (fill !== target) {
          fill = target;
          dirty.current = true;
        }
        const aimNow = worldStore.preview && hover >= 0 ? 1 : 0;
        if (aim !== aimNow) {
          aim = aimNow;
          dirty.current = true;
        }
        if (!dirty.current) return;
        dirty.current = false;
        hud.draw({
          time: 0,
          theme: hudTheme,
          fill,
          motion: 0,
          hover: hoverBox,
          rows,
          progress,
          ticks,
          flight: 0,
          aim,
          lock: lock.at,
          lockOpen: 0,
          lockFlash: 0,
          lockPing: 0,
          boot: 1,
          split: 0,
          tear: 0,
          tilt: [0, 0],
        });
        return;
      }

      fill += (target - fill) * (1 - Math.exp(-6 * dt));
      // Aiming at a hovered link to another station (the world previews the course)
      const aimTarget = worldStore.preview && hover >= 0 && !lock.travelling ? 1 : 0;
      const aimWas = aim;
      aim += (aimTarget - aim) * (1 - Math.exp(-10 * dt));
      if (Math.abs(aim - aimWas) > 0.002) dirty.current = true;
      stepSway(sway, dt, now, root.dataset.boot === 'leaving');
      bar.style.transform = swayTransform(sway);
      const open = stepLock(lock, now);
      const swinging = swing(sway);

      // The bottom edge: the page's progress, or the flight's course
      const { flight } = worldStore;
      const flying = flight.active && isStation(flight.to);
      flightBlend += (Number(flying) - flightBlend) * (1 - Math.exp(-6 * dt));
      if (Math.abs(flightBlend - Number(flying)) < 0.002) flightBlend = Number(flying);
      const along = mix(scrolled, flying ? flight.progress : 0, flightBlend);
      if (Math.abs(along - progress) > 0.0005) {
        progress = along;
        dirty.current = true;
      }
      ticks.reading = readingAt(ticks, scrolled);
      // Riding the travelling lock: where to, and the range still to go
      const toGo = lock.travelling && flying ? rangeToGo() : null;
      if (toGo) showLabel(courseLabel(toGo.to, toGo.km), lock.at);
      else showLabel('');
      worldStore.hudHum = boot < 1 ? boot : 0.5 + swinging * 0.5;
      // The sway moves every frame; the hologram only needs every other
      // one, unless something on it is changing
      const busy =
        boot < 1 ||
        lock.travelling ||
        sinceLock < 0.6 ||
        sway.jolt.burst > 0 ||
        sway.jolt.last > 0 ||
        (flightBlend > 0 && flightBlend < 1);
      odd = !odd;
      if (!odd && !dirty.current && !busy) return;
      dirty.current = false;
      // Locking: the brackets snap shut with a flash and a ping goes out
      const flash = sinceLock < 0.5 ? 1 - sinceLock / 0.5 : 0;
      const shut = sinceLock < 0.35 ? Math.sin((sinceLock / 0.35) * Math.PI) * -3 : 0;
      hud.draw({
        time: now,
        theme: hudTheme,
        fill,
        motion: 1,
        hover: hoverBox,
        rows,
        progress,
        ticks,
        flight: flightBlend,
        aim,
        lock: lock.at,
        lockOpen: open + shut,
        lockFlash: flash,
        lockPing: sinceLock < 0.6 ? sinceLock / 0.6 : 0,
        boot,
        // Speed only splits and tears the picture during a flight between
        // pages (a fast scroll along the projects ride moves the camera
        // too); the shake's jolt does at any time
        split: Math.max(
          swinging,
          clamp(worldStore.velocity / 260, 0, 0.5) * sway.flying,
          sway.jolt.burst * 0.7
        ),
        tear: Math.max(
          clamp((worldStore.velocity - 80) / 160, 0, 1) * sway.flying,
          sway.jolt.burst * 0.8
        ),
        tilt: [sway.ry.at, sway.rx.at],
      });
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(bootTimer);
      if (header) delete header.dataset.hudBoot;
      resize.disconnect();
      mutations.disconnect();
      pageSize.disconnect();
      window.clearTimeout(tickTimer);
      showLabel('');
      bar.removeEventListener('pointerover', over);
      bar.removeEventListener('pointerout', out);
      bar.removeEventListener('focusin', over);
      bar.removeEventListener('focusout', out);
      bar.removeEventListener('click', click);
      bar.style.transform = '';
      worldStore.hudHum = 0;
      hud.dispose();
    };
  }, [onLive]);

  return (
    <>
      <canvas ref={canvasRef} className="header-hud" aria-hidden="true" />
      {/* Rides the target lock as it travels: where to, and how far still to go */}
      <span ref={courseRef} className="header-hud__course" aria-hidden="true" hidden />
    </>
  );
}

export default HeaderHud;
