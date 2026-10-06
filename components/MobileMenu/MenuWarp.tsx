'use client';

import { useEffect, useRef } from 'react';

/* ------------------------------------------------------------------
   The mobile menu's backdrop: a starfield drawn by one full-screen
   shader, in plain WebGL (no three.js), so nothing loads or compiles
   until the menu first opens. Opening it jumps to warp: stars streak out
   from the middle of the screen, then slow to a drift through a violet
   and cyan nebula. Closing spools the warp back up as the menu fades.

   The stars live in log-polar space (angle round the centre, log of the
   distance from it), where flying forward is a steady slide outward that
   spreads and grows the stars like perspective, and a streak is a
   stretch along the radius.
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
uniform float uTime;
uniform float uTravel;
uniform float uWarp;
uniform vec3 uBg;
uniform vec3 uViolet;
uniform vec3 uCyan;
uniform vec3 uStar;
uniform float uLight;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float r = max(length(uv), 1e-4);
  float angle = atan(uv.y, uv.x);
  float depth = log(r);

  // Nebula: violet high on the right, cyan low on the left, drifting; a
  // glow at the vanishing point while warping
  vec3 col = uBg;
  vec2 a = uv - vec2(0.42, 0.5) + 0.06 * vec2(sin(uTime * 0.11), cos(uTime * 0.13));
  vec2 b = uv - vec2(-0.38, -0.55) + 0.06 * vec2(cos(uTime * 0.09), sin(uTime * 0.12));
  float nebula = 1.0 - 0.55 * uLight;
  col += uViolet * exp(-dot(a, a) * 3.2) * 0.32 * nebula;
  col += uCyan * exp(-dot(b, b) * 2.8) * 0.22 * nebula;
  col += uCyan * exp(-r * r * 18.0) * uWarp * 0.35 * nebula;

  // Three layers of stars on log-polar grids, sliding outward
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
    tint += star * mix(uStar, mix(uCyan, uViolet, hash(id + seed + 4.1)), 0.35);
  }
  vec3 starColour = tint / max(amount, 1e-3);
  col = mix(col, starColour, clamp(amount, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

type Rgb = [number, number, number];
interface Palette {
  bg: Rgb;
  violet: Rgb;
  cyan: Rgb;
  star: Rgb;
  light: number;
}

const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Matches the themes' --bg-primary and accents (app/theme-variables.scss) */
const palettes: Record<'dark' | 'light', Palette> = {
  dark: {
    bg: rgb('#05060d'),
    violet: rgb('#8b5cf6'),
    cyan: rgb('#22d3ee'),
    star: rgb('#eef8ff'),
    light: 0,
  },
  light: {
    bg: rgb('#eef0f8'),
    violet: rgb('#7c3aed'),
    cyan: rgb('#0891b2'),
    star: rgb('#4c1d95'),
    light: 1,
  },
};

/** The warp: held this long after opening, then easing off over `settle` (s) */
const hold = 0.12;
const settle = 1.1;
/** Closing: how long the warp takes to spool back up (s); the menu fades over the same */
const spoolUp = 0.35;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

/**
 * Sets up the shader on a canvas and returns its controls, or null where
 * WebGL can't start. Draws only while opening, open or closing
 */
function createWarp(canvas: HTMLCanvasElement, onLost: () => void) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  // One triangle that covers the screen
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const at = (name: string) => gl.getUniformLocation(program, name);
  const uniforms = {
    res: at('uRes'),
    time: at('uTime'),
    travel: at('uTravel'),
    warp: at('uWarp'),
    bg: at('uBg'),
    violet: at('uViolet'),
    cyan: at('uCyan'),
    star: at('uStar'),
    light: at('uLight'),
  };

  const state = {
    open: false,
    still: false,
    openedAt: 0,
    closedAt: 0,
    closeFrom: 0,
    travel: 0,
    last: 0,
    frame: 0,
    palette: palettes.dark,
  };

  const warpAt = (now: number) => {
    if (state.still) return 0;
    if (state.open) {
      const x = Math.min(Math.max(((now - state.openedAt) / 1000 - hold) / settle, 0), 1);
      return (1 - x) ** 3;
    }
    const x = Math.min((now - state.closedAt) / 1000 / spoolUp, 1);
    return state.closeFrom + (0.85 - state.closeFrom) * x * x;
  };

  const draw = (now: number) => {
    // Rendered at up to 1.5× for crisp stars without paying for 3× screens
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    const dt = Math.min((now - state.last) / 1000, 0.05);
    state.last = now;
    const warp = warpAt(now);
    state.travel = (state.travel + dt * (0.05 + warp * 2.2)) % 200;
    const { palette } = state;
    gl.uniform2f(uniforms.res, width, height);
    gl.uniform1f(uniforms.time, now / 1000);
    gl.uniform1f(uniforms.travel, state.travel);
    gl.uniform1f(uniforms.warp, warp);
    gl.uniform3fv(uniforms.bg, palette.bg);
    gl.uniform3fv(uniforms.violet, palette.violet);
    gl.uniform3fv(uniforms.cyan, palette.cyan);
    gl.uniform3fv(uniforms.star, palette.star);
    gl.uniform1f(uniforms.light, palette.light);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (now: number) => {
    draw(now);
    const closed = !state.open && now - state.closedAt > spoolUp * 1000;
    state.frame = closed ? 0 : requestAnimationFrame(loop);
  };
  const run = () => {
    if (!state.frame) state.frame = requestAnimationFrame(loop);
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
    /** `still` (reduced motion): one calm frame, no warp, no drift */
    open(still: boolean) {
      const now = performance.now();
      state.open = true;
      state.still = still;
      state.openedAt = now;
      state.last = now;
      if (still) draw(now);
      else run();
    },
    close() {
      if (!state.open) return;
      const now = performance.now();
      state.closeFrom = warpAt(now);
      state.open = false;
      state.closedAt = now;
      if (!state.still) run();
    },
    setTheme(theme: 'dark' | 'light') {
      state.palette = palettes[theme];
      if (state.still && state.open) draw(performance.now());
    },
    dispose() {
      cancelAnimationFrame(state.frame);
      canvas.removeEventListener('webglcontextlost', lost);
      delete canvas.dataset.live;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

type Warp = NonNullable<ReturnType<typeof createWarp>>;

/**
 * The warp canvas, there only with 3D effects on and WebGL about. Its
 * context starts the first time the menu opens and stays for later opens;
 * without it the menu's own gradient shows instead
 */
export function MenuWarp({
  open,
  theme,
  enabled,
  still,
}: {
  open: boolean;
  theme: 'dark' | 'light';
  /** 3D effects on, and WebGL there */
  enabled: boolean;
  /** Reduced motion */
  still: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const warpRef = useRef<Warp | null>(null);
  const failedRef = useRef(false);
  /** Whether the warp was last told the menu is open */
  const shownRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      warpRef.current?.dispose();
      warpRef.current = null;
      shownRef.current = false;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!warpRef.current) {
      if (!open || failedRef.current) return;
      warpRef.current = createWarp(canvas, () => {
        failedRef.current = true;
        warpRef.current = null;
      });
      if (!warpRef.current) {
        failedRef.current = true;
        return;
      }
    }
    const warp = warpRef.current;
    warp.setTheme(theme);
    // A theme change while open just recolours; only opening and closing warp
    if (open === shownRef.current) return;
    shownRef.current = open;
    if (open) warp.open(still);
    else warp.close();
  }, [open, theme, enabled, still]);

  useEffect(
    () => () => {
      warpRef.current?.dispose();
      warpRef.current = null;
    },
    []
  );

  // No canvas at all without WebGL or with 3D effects off
  if (!enabled) return null;
  return <canvas ref={canvasRef} className="mobile-menu__warp" aria-hidden="true" />;
}
