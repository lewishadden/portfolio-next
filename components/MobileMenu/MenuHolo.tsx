'use client';

import { useEffect, useRef } from 'react';

import { emitCue } from 'components/World/worldStore';

import type { RefObject } from 'react';

/* ------------------------------------------------------------------
   The mobile menu as a hologram (3D effects on), in the header HUD's
   style: one full-screen shader in plain WebGL (no three.js; its context
   starts the first time the menu opens) behind the menu's real links.

   - Behind it, space: opening jumps to warp, stars streaking out from
     the middle of the screen, and drops out of it as the panel powers
     on, leaving a dim starfield drifting past. Closing spools the warp
     back up as the panel switches off.
   - The panel round the links: a thin frame with corner brackets and
     tick marks, a grid and scan lines, a rolling scan line, grain and a
     flicker, lit by the same projector as the header bar, its beam
     fanning down from above the screen with dust drifting in it.
   - Opening powers it on: the top edge draws out from the middle, the
     sides run down behind a bright scan line that brings the grid with
     it, the corners snap in, the links flicker on one by one (CSS) and a
     target lock snaps onto the current page with a flash and a ping.
   - Pointing at a link (or focusing it) lights its row; choosing one
     moves the lock onto it.
   - Closing switches it off like an old screen: it collapses to a bright
     line and then to nothing, the links with it (CSS, in step).

   Reduced motion: no warp, power-on, collapse or drift, one frame, redrawn
   only when something changes.
   ------------------------------------------------------------------ */

const vertexShader = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform float uMotion;
uniform float uTravel;
uniform float uWarp;
uniform vec4 uPanel;
uniform float uBoot;
uniform float uShut;
uniform vec2 uSquash;
uniform vec4 uHover;
uniform vec4 uLock;
uniform float uLockFlash;
uniform float uLockPing;
uniform float uSplit;
uniform vec3 uBg;
uniform vec3 uLine;
uniform vec3 uFillColour;
uniform float uFill;
uniform float uGlow;
uniform float uLineAlpha;
uniform vec3 uStar;

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

/** Brackets round a box: its sides, and its top and bottom only near the ends */
float brackets(vec2 p, vec4 g, float arm) {
  vec2 local = p - g.xy;
  float nearEnd = step(min(local.x, g.z - local.x), arm) * step(-0.5, min(local.x, g.z - local.x));
  return smoothstep(1.6, 0.4, abs(rectDist(p, g))) * nearEnd;
}

/** The hologram's light at a point (its lines, not its tint), in CSS px */
float holo(vec2 p, float t) {
  vec4 r = uPanel;
  float outside = rectDist(p, r);
  if (outside > 40.0) return 0.0;
  vec2 l = p - r.xy;
  float inside = step(outside, 0.0);
  float edge = -outside;

  // Powering on: the top edge draws out from the middle, the sides run
  // down behind a bright scan line that brings the grid, then the corners
  // snap in
  float reach = r.z * 0.5 * smoothstep(0.0, 0.28, uBoot);
  float fromMiddle = abs(l.x - r.z * 0.5);
  float drop = r.w * smoothstep(0.25, 0.6, uBoot);
  float shown = step(l.y, drop + 0.5) * step(0.25, uBoot);
  float onTop = step(l.y, 3.0);
  float frame = smoothstep(1.4, 0.2, abs(outside + 1.0)) * mix(shown, step(fromMiddle, reach + 0.5), onTop);
  float tip = exp(-pow((fromMiddle - reach) / 5.0, 2.0)) * smoothstep(4.0, 0.0, abs(l.y)) * (1.0 - step(0.28, uBoot));
  float scanDown = exp(-pow((l.y - drop) / 2.5, 2.0)) * inside * step(0.25, uBoot) * (1.0 - smoothstep(0.56, 0.62, uBoot));
  float snap = exp(-pow((uBoot - 0.62) * 14.0, 2.0));
  // How far in from the nearest side, across and down (0 outside)
  vec2 depthIn = max(r.zw * 0.5 - abs(l - r.zw * 0.5), 0.0);
  float nearCorner = step(max(depthIn.x, depthIn.y), 22.0);
  float bracket = nearCorner * smoothstep(3.4, 2.2, edge) * inside * step(0.6, uBoot);
  float cornerGlow = smoothstep(26.0, 0.0, max(depthIn.x, depthIn.y));
  float halo = exp(-max(outside, 0.0) / 6.0) * (1.0 - inside) * uGlow * step(l.y, drop + 6.0) * step(0.25, uBoot);

  // The body: a grid, scan lines, tick marks down the sides, a passing
  // sweep, a rolling scan line and fine grain
  float side = min(l.x, r.z - l.x);
  float ticks = step(mod(l.y, 16.0), 1.0) * step(4.0, side) * step(side, 8.0) * 0.35;
  float grid = (step(fract(l.x / 14.0), 0.06) + step(fract(l.y / 14.0), 0.06)) * 0.04;
  float scan = (0.5 + 0.5 * sin(l.y * 1.7 - t * 9.0)) * 0.045;
  float sweep = exp(-pow((l.x / r.z - fract(t * 0.06)) * 10.0, 2.0)) * 0.06 * uMotion;
  float roll = exp(-pow((l.y - (mod(t * 60.0, r.w + 160.0) - 80.0)) / 2.5, 2.0)) * 0.22 * uMotion;
  float grain = (hash(floor(p * 1.5) + floor(t * 24.0)) - 0.5) * 0.06 * uMotion;
  float body = (grid + scan + sweep + roll + grain + ticks) * inside * shown;

  float light = frame * 0.55 + tip * 1.4 + scanDown * 1.1 + bracket * (0.95 + snap * 1.4) + halo * (0.12 + cornerGlow * 0.3) + body;

  // What you point at (or focus): its row lit
  light += smoothstep(1.0, -1.0, rectDist(p, uHover)) * 0.12 * step(0.0, uHover.z) * step(1.0, uBoot);

  // The target lock: brackets round the current page's row, a faint fill
  // in it, and a ping going out as it locks on
  float lockOn = step(0.7, uBoot) * step(0.0, uLock.z);
  vec4 g = vec4(uLock.xy - vec2(6.0, 2.0), uLock.zw + vec2(12.0, 4.0));
  light += lockOn * (brackets(p, g, 10.0) * (1.1 + uLockFlash * 1.6) + smoothstep(1.0, -1.0, rectDist(p, g)) * (0.05 + uLockFlash * 0.25));
  vec4 ping = vec4(g.xy - uLockPing * 14.0, g.zw + uLockPing * 28.0);
  light += lockOn * smoothstep(1.4, 0.3, abs(rectDist(p, ping))) * (1.0 - uLockPing) * step(0.001, uLockPing) * 0.8;
  return light;
}

void main() {
  // CSS pixels from the top left of the screen
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 screen = uRes / uDpr;
  float t = uTime * uMotion;

  // Space, darker towards the edges. The stars live in log-polar space
  // (angle round the middle, log of the distance from it), where flying
  // forward is a steady slide outward that spreads and grows them like
  // perspective, and a warp streak is a stretch along the radius. A glow
  // at the vanishing point while warping
  vec2 uv = (p - screen * 0.5) / screen.y;
  vec3 col = uBg * (1.0 - 0.3 * dot(uv, uv));
  float r = max(length(uv), 1e-4);
  float angle = atan(uv.y, uv.x);
  float depth = log(r);
  col += uLine * exp(-r * r * 18.0) * uWarp * 0.35 * uGlow;
  float amount = 0.0;
  vec3 tint = vec3(0.0);
  for (int layer = 0; layer < 3; layer++) {
    float l = float(layer);
    float cell = 6.2831853 / (36.0 + l * 30.0);
    vec2 grid = vec2(angle, depth - uTravel * (0.7 + 0.3 * l)) / cell;
    vec2 id = floor(grid);
    float seed = l * 19.7;
    float h = hash(id + seed);
    vec2 offset = (vec2(hash(id + seed + 1.7), hash(id + seed + 9.2)) - 0.5) * 0.6;
    // From cell units to screen units, stretched along the radius by the warp
    vec2 d = (fract(grid) - 0.5 - offset) * cell * r;
    d.y /= 1.0 + uWarp * 22.0;
    float size = (0.0016 + 0.0026 * h) * (1.0 + uWarp);
    float star = smoothstep(size, 0.0, length(d)) * step(0.78, h);
    star *= 0.6 + 0.4 * sin(uTime * (1.3 + h * 3.0) + h * 40.0);
    star *= smoothstep(0.03, 0.3, r);
    amount += star;
    tint += star * mix(uStar, uLine, hash(id + seed + 4.1) * 0.6);
  }
  // Dim while drifting behind the panel, bright at warp
  col = mix(col, tint / max(amount, 1e-3), clamp(amount, 0.0, 1.0) * (0.55 + 0.45 * uWarp));

  // The projector: rays fanning down from above the screen onto the
  // panel, with dust drifting through them
  vec2 emitter = vec2(screen.x * 0.5, -160.0);
  vec2 ray = p - emitter;
  float slope = ray.x / max(ray.y, 1.0);
  float spread = (uPanel.z * 0.5 + 8.0) / max(uPanel.y - emitter.y, 1.0);
  float panelBottom = uPanel.y + uPanel.w;
  float cone = (1.0 - smoothstep(0.8, 1.0, abs(slope) / spread)) * smoothstep(panelBottom + 40.0, panelBottom - 30.0, p.y) * step(0.0, uPanel.z);
  float on = smoothstep(0.0, 0.25, uBoot) * (1.0 - smoothstep(0.0, 0.5, uShut));
  float shafts = 0.55 + 0.45 * sin(atan(slope) * 70.0 + t * 0.4) * sin(atan(slope) * 23.0 - t * 0.25);
  float beam = cone * shafts * 0.05 * uGlow * on;
  vec2 dustCell = vec2(slope * 26.0, (ray.y - t * 7.0) / 9.0);
  vec2 dustId = floor(dustCell);
  vec2 dustAt = fract(dustCell) - 0.5 - (vec2(hash(dustId + 1.3), hash(dustId + 8.1)) - 0.5) * 0.6;
  float dust = smoothstep(0.16, 0.0, length(dustAt * vec2(1.0, 2.0))) * step(0.9, hash(dustId)) * cone
    * (0.5 + 0.5 * sin(t * 2.0 + hash(dustId + 4.0) * 30.0)) * 0.3 * uGlow * uMotion * on;
  col += uLine * (beam + dust);

  // Switching off: the panel collapses to a line, then the line to
  // nothing, the links with it (squashOf, below)
  vec2 c = uPanel.xy + uPanel.zw * 0.5;
  vec2 squash = max(uSquash, vec2(0.002));
  vec2 q = c + (p - c) / squash;
  float s2 = clamp((uShut - 0.65) / 0.35, 0.0, 1.0);

  // A see-through tint over the panel, with a faint interference ripple
  float inPanel = step(rectDist(q, uPanel), 0.0) * step(q.y - uPanel.y, uPanel.w * smoothstep(0.25, 0.6, uBoot) + 0.5);
  float ripple = 0.92 + 0.08 * sin(q.y * 0.9 + q.x * 0.05 - t * 3.0);
  col = mix(col, uFillColour, uFill * inPanel * ripple * (1.0 - s2));

  // The lines, with colour fringes while it powers on and off
  float aG = holo(q, t);
  float aR = aG;
  float aB = aG;
  if (uSplit > 0.01) {
    float k = 0.5 + uSplit * 4.0;
    aR = holo(q + vec2(k, 0.0), t);
    aB = holo(q - vec2(k, 0.0), t);
  }
  float flicker = 1.0 - uMotion * 0.08 * (0.5 + 0.5 * sin(t * 53.0) * sin(t * 17.0));
  // Brighter as it collapses, gone at the end
  float gain = flicker * (1.0 + uShut * 2.0) * (1.0 - smoothstep(0.8, 1.0, uShut));
  float a = clamp(max(aG, max(aR, aB) * 0.75) * gain, 0.0, 1.0);
  vec3 light = (uLine * clamp(aG, 0.0, 1.0) + vec3(1.0, 0.3, 0.7) * max(aR - aG, 0.0) * 0.7 + vec3(0.35, 0.55, 1.0) * max(aB - aG, 0.0) * 0.7) * gain;
  // With uLineAlpha under 1 the lines add light, like a projection
  gl_FragColor = vec4(light + col * (1.0 - a * uLineAlpha), 1.0);
}
`;

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** The header HUD's colours (HeaderHud.tsx), over space (dark) or a pale lab wall (light) */
const palettes = {
  dark: {
    bg: rgb('#05060d'),
    line: rgb('#5ee7fa'),
    fill: rgb('#071028'),
    fillAlpha: 0.6,
    glow: 1,
    lineAlpha: 0.55,
    star: rgb('#d4f3ff'),
  },
  light: {
    bg: rgb('#e9eef6'),
    line: rgb('#0e7490'),
    fill: rgb('#f8fbff'),
    fillAlpha: 0.75,
    glow: 0.45,
    lineAlpha: 1,
    star: rgb('#7c8ca3'),
  },
};
export type HoloTheme = keyof typeof palettes;

type Box = [number, number, number, number];
const none: Box = [-999, -999, -1, -1];

/** How long powering on takes (s), and how far through it the lock snaps on */
const bootTime = 1;
const lockAt = 0.7;
/** How long switching off takes (s); keep in step with menu-holo-shut in MobileMenu.scss */
const shutTime = 0.3;
/** The warp: held this long after opening, then easing off over `settle` (s) */
const warpHold = 0.12;
const warpSettle = 1.1;
/** Closing: how long the warp takes to spool back up (s); the menu fades over the same */
const spoolUp = 0.35;

const easeIn = (x: number) => x * x;
/**
 * Switching off, `shut` of the way through: how far the panel is squashed
 * across and down. Down to a line by 65%, then the line to nothing (the
 * same as menu-holo-shut in MobileMenu.scss, which plays without the
 * hologram)
 */
const squashOf = (shut: number): [number, number] => [
  1 - easeIn(Math.min(Math.max((shut - 0.65) / 0.35, 0), 1)),
  1 - 0.988 * easeIn(Math.min(shut / 0.65, 1)),
];

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
  'uTime',
  'uMotion',
  'uTravel',
  'uWarp',
  'uPanel',
  'uBoot',
  'uShut',
  'uSquash',
  'uHover',
  'uLock',
  'uLockFlash',
  'uLockPing',
  'uSplit',
  'uBg',
  'uLine',
  'uFillColour',
  'uFill',
  'uGlow',
  'uLineAlpha',
  'uStar',
] as const;
type Uniforms = Record<(typeof uniformNames)[number], WebGLUniformLocation | null>;

/**
 * Compiles and links the hologram's program, with one triangle that covers
 * the screen, and reads its uniform locations from that program: locations
 * belong to the program they came from, so they are read afresh with every
 * one linked
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

/**
 * Sets up the shader on a canvas and returns its controls, or null where
 * WebGL can't start. Draws only while powering on, open or switching off
 */
function createHolo(
  canvas: HTMLCanvasElement,
  {
    onLost,
    onSquash,
  }: {
    onLost: () => void;
    /** The panel's links collapse with it: squashed this much, at this opacity (1, 1, 1 when open) */
    onSquash: (x: number, y: number, opacity: number) => void;
  }
) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
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
   * Set once this instance is done with: a later one on the same canvas (a
   * remount reuses it, so its context) links a program of its own, and this
   * one's locations would be set with that one in use (INVALID_OPERATION)
   */
  let disposed = false;

  const state = {
    open: false,
    still: false,
    openedAt: 0,
    closedAt: 0,
    /** How hard it was warping as it closed */
    closeFrom: 0,
    last: 0,
    travel: 0,
    frame: 0,
    tick: 0,
    palette: palettes.dark,
    panel: none,
    rows: [] as Box[],
    active: -1,
    hover: -1,
    lock: -1,
    lockedAt: -1e9,
  };

  const bootAt = (now: number) =>
    state.still ? 1 : Math.min(Math.max((now - state.openedAt) / 1000 / bootTime, 0), 1);
  const shutAt = (now: number) =>
    state.open || state.still ? 0 : Math.min((now - state.closedAt) / 1000 / shutTime, 1);
  /** Opening jumps to warp and drops out of it as the panel powers on; closing spools it back up */
  const warpAt = (now: number) => {
    if (state.still) return 0;
    if (state.open) {
      const x = Math.min(Math.max(((now - state.openedAt) / 1000 - warpHold) / warpSettle, 0), 1);
      return (1 - x) ** 3;
    }
    const x = Math.min((now - state.closedAt) / 1000 / spoolUp, 1);
    return state.closeFrom + (0.85 - state.closeFrom) * x * x;
  };

  const draw = (now: number) => {
    if (disposed) return;
    // Rendered at up to 1.5× for crisp lines without paying for 3× screens
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.useProgram(program);
    gl.viewport(0, 0, width, height);
    const dt = Math.min((now - state.last) / 1000, 0.05);
    state.last = now;
    const motion = state.still ? 0 : 1;
    const warp = warpAt(now);
    state.travel = (state.travel + dt * (0.05 + warp * 2.2) * motion) % 200;
    const boot = bootAt(now);
    const shut = shutAt(now);
    const squash = squashOf(shut);
    if (shut > 0) onSquash(squash[0], squash[1], 1 - Math.max((shut - 0.65) / 0.35, 0));
    const since = (now - state.lockedAt) / 1000;
    const { palette } = state;
    gl.uniform2f(u.uRes, width, height);
    gl.uniform1f(u.uDpr, dpr);
    gl.uniform1f(u.uTime, now / 1000);
    gl.uniform1f(u.uMotion, motion);
    gl.uniform1f(u.uTravel, state.travel);
    gl.uniform1f(u.uWarp, warp);
    gl.uniform4fv(u.uPanel, state.panel);
    gl.uniform1f(u.uBoot, boot);
    gl.uniform1f(u.uShut, shut);
    gl.uniform2fv(u.uSquash, squash);
    gl.uniform4fv(u.uHover, state.rows[state.hover] ?? none);
    gl.uniform4fv(u.uLock, state.rows[state.lock] ?? none);
    gl.uniform1f(u.uLockFlash, since >= 0 ? Math.exp(-since / 0.18) : 0);
    gl.uniform1f(u.uLockPing, since >= 0 && since < 0.6 ? since / 0.6 : 0);
    gl.uniform1f(u.uSplit, Math.max(boot < 0.3 ? (1 - boot / 0.3) * 0.8 : 0, shut) * motion);
    gl.uniform3fv(u.uBg, palette.bg);
    gl.uniform3fv(u.uLine, palette.line);
    gl.uniform3fv(u.uFillColour, palette.fill);
    gl.uniform1f(u.uFill, palette.fillAlpha);
    gl.uniform1f(u.uGlow, palette.glow);
    gl.uniform1f(u.uLineAlpha, palette.lineAlpha);
    gl.uniform3fv(u.uStar, palette.star);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (now: number) => {
    const shutting = !state.open && now - state.closedAt < Math.max(shutTime, spoolUp) * 1000 + 50;
    // Every frame while something moves fast, every other one once it's
    // settled into its drift and flicker
    const busy = shutting || warpAt(now) > 0.01 || bootAt(now) < 1 || now - state.lockedAt < 700;
    state.tick += 1;
    if (busy || state.tick % 2 === 0) draw(now);
    state.frame = state.open || shutting ? requestAnimationFrame(loop) : 0;
  };
  const run = () => {
    if (!state.frame && !disposed) state.frame = requestAnimationFrame(loop);
  };
  /** Shows a change: at once if held still, otherwise the loop picks it up */
  const refresh = () => {
    if (state.still && state.open) draw(performance.now());
  };

  /** A link chosen (or the page changed under it): the lock jumps onto it */
  const select = (index: number) => {
    if (index === state.lock || index < 0) return;
    state.lock = index;
    state.lockedAt = state.still ? -1e9 : performance.now();
    emitCue('hud-lock');
    refresh();
  };

  const lost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(state.frame);
    state.frame = 0;
    delete canvas.dataset.live;
    onLost();
  };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.dataset.live = '';

  return {
    /** `still` (reduced motion): no power-on, no drift, one frame */
    open(still: boolean) {
      const now = performance.now();
      state.open = true;
      state.still = still;
      state.openedAt = now;
      state.last = now;
      state.hover = -1;
      state.lock = state.active;
      state.lockedAt = still ? -1e9 : now + lockAt * bootTime * 1000;
      onSquash(1, 1, 1);
      if (still) {
        draw(now);
        return;
      }
      emitCue('hud-boot');
      run();
    },
    close() {
      if (!state.open) return;
      const now = performance.now();
      state.closeFrom = warpAt(now);
      state.open = false;
      state.closedAt = now;
      if (!state.still) run();
    },
    setTheme(theme: HoloTheme) {
      state.palette = palettes[theme];
      refresh();
    },
    /** Where the panel and each link's row are on screen (CSS px) */
    setBoxes(panel: Box, rows: Box[]) {
      state.panel = panel;
      state.rows = rows;
      refresh();
    },
    /** The current page's link; the lock moves onto it if it changes while open */
    setActive(index: number) {
      state.active = index;
      if (state.open) select(index);
    },
    setHover(index: number) {
      if (index === state.hover) return;
      state.hover = index;
      if (index >= 0 && state.open) emitCue('hud-hover');
      refresh();
    },
    select,
    // The context goes with the canvas; losing it here would break a remount
    // that reuses the canvas (React runs effects twice in development)
    dispose() {
      disposed = true;
      cancelAnimationFrame(state.frame);
      state.frame = 0;
      canvas.removeEventListener('webglcontextlost', lost);
      delete canvas.dataset.live;
      gl.deleteProgram(program);
    },
  };
}

type Holo = NonNullable<ReturnType<typeof createHolo>>;

/** Squashes the menu's panel (its links) with the hologram's frame; 1, 1, 1 puts it back */
function squashPanel(menu: HTMLElement | null, x: number, y: number, opacity: number) {
  const panel = menu?.querySelector<HTMLElement>('.mobile-menu__panel');
  if (!panel) return;
  const whole = x === 1 && y === 1 && opacity === 1;
  panel.style.transform = whole ? '' : `scale(${x}, ${y})`;
  panel.style.opacity = whole ? '' : String(opacity);
}

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return [r.left, r.top, r.width, r.height];
};

/**
 * The hologram canvas, there only while the header is a HUD (3D effects
 * on and WebGL working). Its context starts the first time the menu
 * opens and stays for later opens; without it the menu's own background
 * shows instead
 */
export function MenuHolo({
  open,
  theme,
  still,
  active,
  menuRef,
}: {
  open: boolean;
  theme: HoloTheme;
  /** Reduced motion */
  still: boolean;
  /** Which link is the current page, -1 for none */
  active: number;
  /** The menu: its `.mobile-menu__panel` and `.mobile-menu__link`s are what the hologram frames */
  menuRef: RefObject<HTMLElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holoRef = useRef<Holo | null>(null);
  const failedRef = useRef(false);
  /** Whether the hologram was last told the menu is open */
  const shownRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!holoRef.current) {
      if (!open || failedRef.current) return;
      holoRef.current = createHolo(canvas, {
        onLost: () => {
          failedRef.current = true;
          holoRef.current = null;
          squashPanel(menuRef.current, 1, 1, 1);
        },
        onSquash: (x, y, opacity) => squashPanel(menuRef.current, x, y, opacity),
      });
      if (!holoRef.current) {
        failedRef.current = true;
        return;
      }
    }
    const holo = holoRef.current;
    holo.setTheme(theme);
    // A theme change while open just recolours; only opening and closing
    // power it on and off. Closed before the page changes, so the lock stays
    // on the link just chosen
    const changed = open !== shownRef.current;
    shownRef.current = open;
    if (changed && !open) holo.close();
    holo.setActive(active);
    if (changed && open) holo.open(still);
  }, [open, theme, still, active, menuRef]);

  // While open: keep the frame on the panel and the rows, and follow the
  // pointer and focus over the links
  useEffect(() => {
    const root = menuRef.current;
    const panel = root?.querySelector('.mobile-menu__panel');
    const body = root?.querySelector('.mobile-menu__body');
    if (!open || !root || !panel) return;
    const links = () => Array.from(root.querySelectorAll('.mobile-menu__link'));
    const measure = () => holoRef.current?.setBoxes(boxOf(panel), links().map(boxOf));
    const indexOf = (target: EventTarget | null) => {
      const link = target instanceof Element ? target.closest('.mobile-menu__link') : null;
      return link ? links().indexOf(link) : -1;
    };
    const point = (e: PointerEvent | FocusEvent) => holoRef.current?.setHover(indexOf(e.target));
    const leave = (e: PointerEvent | FocusEvent) => {
      if (indexOf(e.relatedTarget) < 0) holoRef.current?.setHover(-1);
    };
    const choose = (e: MouseEvent) => holoRef.current?.select(indexOf(e.target));

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    window.addEventListener('resize', measure);
    body?.addEventListener('scroll', measure, { passive: true });
    root.addEventListener('pointerover', point);
    root.addEventListener('pointerout', leave);
    root.addEventListener('focusin', point);
    root.addEventListener('focusout', leave);
    root.addEventListener('click', choose);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      body?.removeEventListener('scroll', measure);
      root.removeEventListener('pointerover', point);
      root.removeEventListener('pointerout', leave);
      root.removeEventListener('focusin', point);
      root.removeEventListener('focusout', leave);
      root.removeEventListener('click', choose);
      holoRef.current?.setHover(-1);
    };
  }, [open, menuRef]);

  // Gone (3D effects switched off): the panel is left as it was
  useEffect(() => {
    const menu = menuRef.current;
    return () => {
      holoRef.current?.dispose();
      holoRef.current = null;
      squashPanel(menu, 1, 1, 1);
    };
  }, [menuRef]);

  return <canvas ref={canvasRef} className="mobile-menu__holo" aria-hidden="true" />;
}
