'use client';

import { useEffect, useRef } from 'react';

import { worldStore } from 'components/World/worldStore';

import './HeaderHud.scss';

/* ------------------------------------------------------------------
   The header bar as a cockpit HUD (3D effects on): a hologram drawn by
   one shader in plain WebGL (no three.js, so the header stays light)
   on a canvas behind the bar's real links and buttons. A thin frame
   with corner brackets, a faint grid, scan lines, a passing sweep and a
   flicker; the current page in brackets with an underline, and what
   you point at lit. Its fill thickens once the page scrolls under it,
   so the links stay readable.

   It hangs in the cockpit, so it moves with the world's camera: it lags
   behind turns and drifts, banks into them, shakes a little at speed
   and leans towards the pointer, by transforming the whole bar (links
   included) every frame. Reduced motion holds it still.
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
uniform vec4 uRects[12];
uniform float uCount;
uniform float uActive;
uniform float uHover;
uniform vec3 uLine;
uniform vec3 uFillColour;
uniform float uFill;
uniform float uGlow;
uniform float uMotion;

float rectDist(vec2 p, vec4 r) {
  vec2 c = r.xy + r.zw * 0.5;
  vec2 q = abs(p - c) - r.zw * 0.5;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

void main() {
  // Bar-local CSS pixels, from its top left corner
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr - uMargin;
  float t = uTime * uMotion;

  // Pointing at a link now and then knocks a band of the hologram sideways
  float jump = step(0.94, fract(sin(floor(t * 14.0) * 91.7) * 43758.5)) * step(0.0, uHover);
  p.x += jump * 5.0 * sin(p.y * 0.4);

  float outside = rectDist(p, vec4(0.0, 0.0, uSize));
  float inside = step(outside, 0.0);
  float edge = -outside;
  float frame = smoothstep(1.4, 0.2, abs(outside + 1.0));
  float nearCorner = step(min(p.x, uSize.x - p.x), 20.0) * step(min(p.y, uSize.y - p.y), 20.0);
  float bracket = nearCorner * smoothstep(3.4, 2.2, edge) * inside;
  float halo = exp(-max(outside, 0.0) / 5.0) * (1.0 - inside) * uGlow;

  float grid = (step(fract(p.x / 12.0), 0.07) + step(fract(p.y / 12.0), 0.07)) * 0.045 * inside;
  float scan = (0.5 + 0.5 * sin(p.y * 1.7 - t * 9.0)) * 0.05 * inside;
  float sweep = exp(-pow((p.x / uSize.x - fract(t * 0.07)) * 12.0, 2.0)) * 0.08 * inside * uMotion;

  float line = frame * 0.5 + bracket * 0.95 + grid + scan + sweep + halo * (0.12 + nearCorner * 0.3);

  for (int i = 0; i < 12; i++) {
    if (float(i) >= uCount) break;
    vec4 r = uRects[i];
    float isActive = 1.0 - step(0.5, abs(float(i) - uActive));
    float isHover = 1.0 - step(0.5, abs(float(i) - uHover));
    // The current page: corner brackets just outside it, and an underline
    vec4 g = vec4(r.xy - 5.0, r.zw + 10.0);
    vec2 local = p - g.xy;
    float d = rectDist(p, g);
    float nearSide = step(min(local.x, g.z - local.x), 8.0) * step(-0.5, min(local.x, g.z - local.x));
    float ring = smoothstep(1.6, 0.4, abs(d));
    float under = smoothstep(2.0, 0.0, abs(p.y - (r.y + r.w + 3.0))) * step(r.x, p.x) * step(p.x, r.x + r.z);
    line += isActive * (ring * nearSide * 1.1 + under * 0.9);
    line += isActive * exp(-abs(p.y - (r.y + r.w + 3.0)) / 4.0) * step(r.x, p.x) * step(p.x, r.x + r.z) * 0.25 * uGlow;
    // What you point at: lit
    line += isHover * smoothstep(1.0, -1.0, d) * 0.16;
  }

  float flicker = 1.0 - uMotion * 0.1 * (0.5 + 0.5 * sin(t * 53.0) * sin(t * 17.0));
  float a = clamp(line, 0.0, 1.0) * flicker;
  float fill = uFill * inside;
  // Premultiplied: the lines over the fill
  vec3 colour = uLine * a + uFillColour * fill * (1.0 - a);
  gl_FragColor = vec4(colour, a + fill * (1.0 - a));
}
`;

/** Room round the bar for its glow and its sway (CSS px) */
export const hudMargin = 22;
const maxTargets = 12;

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * The hologram per theme; `clear` is the fill over open space, `dense` once
 * the page is under it (no backdrop blur: blurring under a bar that moves
 * every frame is costly, and it glitched on Android, so the fill is thick)
 */
const palettes = {
  dark: { line: rgb('#5ee7fa'), fill: rgb('#060818'), clear: 0.12, dense: 0.93, glow: 1 },
  light: { line: rgb('#0e7490'), fill: rgb('#f5f7fd'), clear: 0.2, dense: 0.95, glow: 0.45 },
};
export type HudTheme = keyof typeof palettes;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

/** What the hologram frames: links and buttons, in bar-local CSS pixels */
interface Targets {
  rects: Float32Array;
  count: number;
  active: number;
  hover: number;
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

  const at = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    res: at('uRes'),
    dpr: at('uDpr'),
    size: at('uSize'),
    margin: at('uMargin'),
    time: at('uTime'),
    rects: at('uRects'),
    count: at('uCount'),
    active: at('uActive'),
    hover: at('uHover'),
    line: at('uLine'),
    fillColour: at('uFillColour'),
    fill: at('uFill'),
    glow: at('uGlow'),
    motion: at('uMotion'),
  };

  const lost = (e: Event) => {
    e.preventDefault();
    onLost();
  };
  canvas.addEventListener('webglcontextlost', lost);

  return {
    resize(width: number, height: number, dpr: number) {
      const w = Math.round((width + hudMargin * 2) * dpr);
      const h = Math.round((height + hudMargin * 2) * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.dpr, dpr);
      gl.uniform2f(u.size, width, height);
      gl.uniform1f(u.margin, hudMargin);
    },
    draw(time: number, targets: Targets, theme: HudTheme, fill: number, motion: number) {
      const palette = palettes[theme];
      gl.uniform1f(u.time, time);
      gl.uniform4fv(u.rects, targets.rects);
      gl.uniform1f(u.count, targets.count);
      gl.uniform1f(u.active, targets.active);
      gl.uniform1f(u.hover, targets.hover);
      gl.uniform3fv(u.line, palette.line);
      gl.uniform3fv(u.fillColour, palette.fill);
      gl.uniform1f(u.fill, palette.clear + (palette.dense - palette.clear) * fill);
      gl.uniform1f(u.glow, palette.glow);
      gl.uniform1f(u.motion, motion);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    // The context goes with the canvas; losing it here would break a remount
    // that reuses the canvas (React runs effects twice in development)
    dispose() {
      canvas.removeEventListener('webglcontextlost', lost);
      gl.deleteProgram(program);
    },
  };
}

/** A box relative to the bar, ignoring the bar's own transform */
function offsetIn(node: HTMLElement, bar: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = node;
  while (n && n !== bar) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return [x, y, node.offsetWidth, node.offsetHeight];
}

/* ---------- How the HUD moves with the camera ---------- */

interface Sway {
  primed: boolean;
  camera: { x: number; y: number; z: number; heading: number; pitch: number };
  /** Current offsets (px, degrees) and their velocities */
  x: number;
  y: number;
  roll: number;
  vx: number;
  vy: number;
  vroll: number;
  tiltX: number;
  tiltY: number;
}

const createSway = (): Sway => ({
  primed: false,
  camera: { x: 0, y: 0, z: 0, heading: 0, pitch: 0 },
  x: 0,
  y: 0,
  roll: 0,
  vx: 0,
  vy: 0,
  vroll: 0,
  tiltX: 0,
  tiltY: 0,
});

const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** A damped spring towards `target` */
function spring(value: number, velocity: number, target: number, dt: number): [number, number] {
  const next = velocity + ((target - value) * 70 - velocity * 13) * dt;
  return [value + next * dt, next];
}

/**
 * One frame of sway: the camera's turn, bank and drift (from worldStore,
 * written by the world every frame) push the HUD the other way, a spring
 * brings it back; it floats a little at rest and leans with the pointer
 */
function stepSway(s: Sway, dt: number, t: number) {
  const cam = worldStore.camera;
  const pitch = Math.asin(clamp(cam.fy, -1, 1));
  const last = s.camera;
  // A jump (a new page with reduced motion, a long pause) is not motion
  const jumped = Math.hypot(cam.x - last.x, cam.y - last.y, cam.z - last.z) > 400 * dt + 5;
  let lateral = 0;
  let vertical = 0;
  let yawRate = 0;
  let pitchRate = 0;
  if (s.primed && !jumped && dt > 0) {
    const vx = (cam.x - last.x) / dt;
    const vy = (cam.y - last.y) / dt;
    const vz = (cam.z - last.z) / dt;
    // Sideways in the camera's view: right is (cos h, 0, sin h)
    lateral = vx * Math.cos(cam.heading) + vz * Math.sin(cam.heading);
    vertical = vy;
    yawRate = wrap(cam.heading - last.heading) / dt;
    pitchRate = (pitch - last.pitch) / dt;
  }
  s.primed = true;
  last.x = cam.x;
  last.y = cam.y;
  last.z = cam.z;
  last.heading = cam.heading;
  last.pitch = pitch;

  const shake = clamp(worldStore.velocity / 220, 0, 1);
  const targetX =
    clamp(-lateral * 0.1 - yawRate * 16, -14, 14) +
    Math.sin(t * 0.37) * 1.2 +
    Math.sin(t * 31) * shake * 0.7;
  const targetY =
    clamp(vertical * 0.08 + pitchRate * 10, -8, 8) +
    Math.cos(t * 0.29) * 0.8 +
    Math.cos(t * 27) * shake * 0.5;
  const targetRoll = clamp(yawRate * 2.4 + lateral * 0.01, -2.5, 2.5) + Math.sin(t * 0.21) * 0.12;
  [s.x, s.vx] = spring(s.x, s.vx, targetX, dt);
  [s.y, s.vy] = spring(s.y, s.vy, targetY, dt);
  [s.roll, s.vroll] = spring(s.roll, s.vroll, targetRoll, dt);
  const ease = 1 - Math.exp(-4 * dt);
  s.tiltY += (worldStore.pointerX * 2.2 - s.tiltY) * ease;
  s.tiltX += (worldStore.pointerY * 1.4 - s.tiltX) * ease;
}

const swayTransform = (s: Sway) =>
  `perspective(1100px) translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0) rotate(${s.roll.toFixed(3)}deg) rotateX(${s.tiltX.toFixed(3)}deg) rotateY(${s.tiltY.toFixed(3)}deg)`;

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

    const targets: Targets = {
      rects: new Float32Array(maxTargets * 4),
      count: 0,
      active: -1,
      hover: -1,
    };
    let elements: HTMLElement[] = [];
    let fill = props.current.dense ? 1 : 0;
    const sway = createSway();

    const measure = () => {
      elements = [
        ...bar.querySelectorAll<HTMLElement>('.header__link, .header__actions > *'),
      ].slice(0, maxTargets);
      targets.rects.fill(-999);
      elements.forEach((el, i) => {
        if (!el.offsetParent) return;
        // Offsets run from the bar's padding box; the shader from its border box
        const [x, y, w, h] = offsetIn(el, bar);
        targets.rects.set([x + bar.clientLeft, y + bar.clientTop, w, h], i * 4);
      });
      targets.count = elements.length;
      targets.active = elements.findIndex((el) => el.getAttribute('aria-current') === 'page');
      hud.resize(bar.offsetWidth, bar.offsetHeight, Math.min(window.devicePixelRatio || 1, 2));
      dirty.current = true;
    };

    // What you point at (or focus), by delegation
    const targetOf = (node: EventTarget | null) =>
      node instanceof Node ? elements.findIndex((el) => el.contains(node)) : -1;
    const over = (e: Event) => {
      targets.hover = targetOf(e.target);
      dirty.current = true;
    };
    const out = (e: PointerEvent | FocusEvent) => {
      if (targetOf(e.relatedTarget) < 0) targets.hover = -1;
      dirty.current = true;
    };
    bar.addEventListener('pointerover', over);
    bar.addEventListener('pointerout', out);
    bar.addEventListener('focusin', over);
    bar.addEventListener('focusout', out);

    const resize = new ResizeObserver(measure);
    resize.observe(bar);
    // The current page changes with navigation
    const mutations = new MutationObserver(measure);
    mutations.observe(bar, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
    document.fonts?.ready.then(measure);
    measure();

    const header = bar.closest('header');
    const root = document.documentElement;
    /** Nothing to draw while the header is out of sight: tour, free roam, scrolled away, loading */
    const away = () =>
      (root.dataset.worldMode !== undefined && root.dataset.worldMode !== 'page') ||
      root.hasAttribute('data-boot') ||
      !!header?.classList.contains('header--hidden');

    let frame = 0;
    let last = performance.now();
    let odd = false;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (failed) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (away()) {
        dirty.current = true;
        return;
      }
      const { theme: hudTheme, dense: thick, still: calm } = props.current;
      const target = thick ? 1 : 0;
      if (calm) {
        bar.style.transform = '';
        if (fill !== target) {
          fill = target;
          dirty.current = true;
        }
        if (!dirty.current) return;
        dirty.current = false;
        hud.draw(0, targets, hudTheme, fill, 0);
        return;
      }
      fill += (target - fill) * (1 - Math.exp(-6 * dt));
      stepSway(sway, dt, now / 1000);
      bar.style.transform = swayTransform(sway);
      // The sway moves every frame; the hologram's flicker and scan lines
      // only need every other one (unless something on it has changed)
      odd = !odd;
      if (!odd && !dirty.current) return;
      dirty.current = false;
      hud.draw(now / 1000, targets, hudTheme, fill, 1);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      bar.removeEventListener('pointerover', over);
      bar.removeEventListener('pointerout', out);
      bar.removeEventListener('focusin', over);
      bar.removeEventListener('focusout', out);
      bar.style.transform = '';
      hud.dispose();
    };
  }, [onLive]);

  return <canvas ref={canvasRef} className="header-hud" aria-hidden="true" />;
}

export default HeaderHud;
