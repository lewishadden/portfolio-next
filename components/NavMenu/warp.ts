/* ------------------------------------------------------------------
   The star map's backdrop: a starfield drawn by one full-screen shader.
   Opening the menu jumps to warp: stars streak out from the middle of
   the screen, then slow to a drift through a violet and cyan nebula.
   Closing spools the warp back up as the menu fades.

   The stars live in log-polar space (angle round the centre, log of the
   distance from it), where flying forward is a steady slide outward that
   spreads and grows the stars like perspective, and a streak is a
   stretch along the radius.
   ------------------------------------------------------------------ */

/** A triangle that covers the screen, behind everything */
export const warpVertex = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

export const warpFragment = /* glsl */ `
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

export type MapTheme = 'dark' | 'light';

/** Matches the themes' --bg-primary and accents (app/theme-variables.scss) */
export const warpPalettes: Record<
  MapTheme,
  { bg: string; violet: string; cyan: string; star: string; light: number }
> = {
  dark: { bg: '#05060d', violet: '#8b5cf6', cyan: '#22d3ee', star: '#eef8ff', light: 0 },
  light: { bg: '#eef0f8', violet: '#7c3aed', cyan: '#0891b2', star: '#4c1d95', light: 1 },
};

/** The warp on opening: held this long, then easing off over `settle` (s) */
const hold = 0.12;
const settle = 1.1;
/** Closing: how long the warp takes to spool back up (s); the menu fades over the same */
export const spoolUp = 0.35;

/** When the menu last opened or closed, for the warp and the camera's arrival */
export class MapTimeline {
  open = false;
  changedAt = -1;
  /** The warp when the menu closed, which spools up from there */
  private closeFrom = 0;

  /** Starts as the menu is (the map mounts as it opens), so the first frame is right */
  constructor(open: boolean, now: number) {
    this.open = open;
    this.changedAt = open ? now : -1;
  }

  set(open: boolean, now: number) {
    if (open === this.open && this.changedAt >= 0) return;
    if (!open) this.closeFrom = this.warp(now);
    this.open = open;
    this.changedAt = now;
  }

  /** Seconds since the menu opened or closed */
  since(now: number) {
    return this.changedAt < 0 ? Infinity : now - this.changedAt;
  }

  /** 1 at full warp, 0 drifting */
  warp(now: number) {
    const t = this.since(now);
    if (this.open) {
      const x = Math.min(Math.max((t - hold) / settle, 0), 1);
      return (1 - x) ** 3;
    }
    const x = Math.min(t / spoolUp, 1);
    return this.closeFrom + (0.85 - this.closeFrom) * x * x;
  }

  /** 0 → 1 as the camera arrives out of the warp; back towards 0 as it leaves */
  arrival(now: number) {
    const t = this.since(now);
    if (this.open) return 1 - (1 - Math.min(Math.max((t - 0.05) / 1.1, 0), 1)) ** 3;
    return 1 - Math.min(t / spoolUp, 1) ** 2 * 0.6;
  }
}
