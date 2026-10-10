import { worldStore } from './worldStore';

import type { IdleWindow } from './types';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Mission patches for the experience pods: the same badge each role's
   card wears on the page (components/Experience/MissionPatch.tsx), drawn
   to a canvas for the 3D world. Drawn with the 2D canvas API rather than
   from an SVG string: an SVG drawn as an image can't use the page's web
   fonts, and the patch's lettering is Geist Mono and Unbounded.
   Geometry is in the SVG's 120-unit viewBox; colours are the page's
   theme tokens, mixed in oklab as its CSS mixes them.
   ------------------------------------------------------------------ */

/** What a patch says: the mission number, the company round the bottom and its monogram */
export interface PatchRole {
  company: string;
  initials: string;
  mission: number;
}

/** Pixels per side of one patch */
export const patchSize = 256;

/** Patches per row of the atlas */
export const patchColumns = 4;

/** The theme tokens the patch uses (keep in step with app/theme-variables.scss) */
const tokens: Record<
  WorldTheme,
  { tones: string[]; bgPrimary: string; bgSecondary: string; text: string }
> = {
  dark: {
    // --accent-primary, --accent-secondary, --accent-tertiary, amber, --status-ok
    tones: ['#a78bfa', '#22d3ee', '#f472b6', '#f59e0b', '#bef264'],
    bgPrimary: '#05060d',
    bgSecondary: '#0a0c18',
    text: '#eef0ff',
  },
  light: {
    tones: ['#6d28d9', '#0e7490', '#be185d', '#f59e0b', '#2a5506'],
    bgPrimary: '#eef0f8',
    bgSecondary: '#e4e7f4',
    text: '#0b0d1f',
  },
};

/* ----------------------------- oklab mixing ----------------------------- */

type Rgb = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function toOklab([r, g, b]: Rgb): Rgb {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear: Rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((c) => Math.min(1, Math.max(0, toSrgb(c)))) as Rgb;
}

/** `color-mix(in oklab, a share, b)` as an rgb() string */
function mix(a: string, share: number, b: string) {
  const [x, y] = [toOklab(hexToRgb(a)), toOklab(hexToRgb(b))];
  const [r, g, bl] = fromOklab([0, 1, 2].map((i) => x[i] * share + y[i] * (1 - share)) as Rgb);
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(bl * 255)})`;
}

/** A colour at an opacity (`color-mix(in oklab, colour share, transparent)`) */
function fade(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${alpha})`;
}

/* --------------------------------- fonts --------------------------------- */

/** A font family list from one of the page's CSS variables (`--font-mono`), resolved */
export function cssFontFamily(variable: string, fallback: string) {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

/** Resolves once the fonts the patches letter with are loaded (or failed: system fonts stand in) */
export async function patchFontsReady() {
  const mono = cssFontFamily('--font-mono', 'monospace');
  const display = cssFontFamily('--font-display', 'sans-serif');
  await Promise.all([
    document.fonts.load(`500 20px ${mono}`),
    document.fonts.load(`700 28px ${display}`),
  ]).catch(() => undefined);
  await document.fonts.ready;
}

/* --------------------------------- drawing --------------------------------- */

/** Letters `text` along a circle round (60, 60): over the top, or upright along the bottom */
function arcText(ctx: CanvasRenderingContext2D, text: string, radius: number, top: boolean) {
  const size = parseFloat(ctx.font.match(/([\d.]+)px/)?.[1] ?? '9.5');
  const spacing = size * 0.14;
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((sum, w) => sum + w, 0) - spacing;
  let along = -total / 2;
  [...text].forEach((ch, i) => {
    const centre = along + (widths[i] - spacing) / 2;
    along += widths[i];
    // Over the top the letters stand on the circle, along the bottom they hang inside it
    const angle = top ? -Math.PI / 2 + centre / radius : Math.PI / 2 - centre / radius;
    ctx.save();
    ctx.translate(60 + Math.cos(angle) * radius, 60 + Math.sin(angle) * radius);
    ctx.rotate(top ? angle + Math.PI / 2 : angle - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

/** The page's lettering for the patches (each a getComputedStyle, so read once per atlas) */
function patchFonts() {
  return {
    mono: cssFontFamily('--font-mono', 'monospace'),
    display: cssFontFamily('--font-display', 'sans-serif'),
  };
}

/**
 * Draws a role's patch (`tone` 0-4 picks its colour, as `.xp__patch--N`
 * does) into a new `patchSize` square canvas, for the given theme
 */
export function drawPatch(
  role: PatchRole,
  tone: number,
  theme: WorldTheme,
  { mono, display } = patchFonts()
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = patchSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const palette = tokens[theme];
  const patch = palette.tones[tone % palette.tones.length];

  ctx.scale(patchSize / 120, patchSize / 120);
  const circle = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  };

  // Rim, stitching, the field and its planet
  circle(60, 60, 56);
  ctx.fillStyle = mix(patch, 0.14, palette.bgSecondary);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = patch;
  ctx.stroke();
  circle(60, 60, 51.5);
  ctx.setLineDash([2.4, 2.2]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = fade(patch, 0.7);
  ctx.stroke();
  ctx.setLineDash([]);
  circle(60, 60, 31);
  ctx.fillStyle = mix(palette.bgPrimary, 0.75, patch);
  ctx.fill();
  ctx.strokeStyle = fade(patch, 0.5);
  ctx.stroke();
  circle(60, 60, 17);
  ctx.fillStyle = mix(patch, 0.55, palette.bgPrimary);
  ctx.fill();

  // The orbit, its satellite and a few stars
  ctx.beginPath();
  ctx.ellipse(60, 60, 27, 8, (-18 * Math.PI) / 180, 0, Math.PI * 2);
  ctx.strokeStyle = fade(palette.text, 0.6);
  ctx.stroke();
  ctx.fillStyle = palette.text;
  for (const [x, y, r] of [
    [84.5, 51, 2.6],
    [30, 42, 1.2],
    [91, 79, 1],
    [38, 83, 0.8],
  ]) {
    circle(x, y, r);
    ctx.fill();
  }

  // The monogram, then the mission number over the top and the company round the bottom
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 13px ${display}`;
  ctx.letterSpacing = '-0.26px';
  ctx.fillText(role.initials, 60, 64.5);
  ctx.letterSpacing = '0px';
  ctx.font = `500 9.5px ${mono}`;
  arcText(ctx, `MISSION ${String(role.mission).padStart(2, '0')}`, 40, true);
  arcText(ctx, role.company.toUpperCase(), 47, false);
  return canvas;
}

/**
 * Resolves at an idle moment with no camera flight under way. Drawing a
 * patch takes a few milliseconds of canvas work (several on a slow phone):
 * on the frame the station mounts, as a flight to it sets off, that made
 * the flight's first frame longer
 */
function quietMoment() {
  return new Promise<void>((resolve) => {
    const w = window as IdleWindow;
    const wait = () => {
      if (worldStore.flight.active) {
        window.setTimeout(wait, 200);
        return;
      }
      if (!w.requestIdleCallback) {
        window.setTimeout(resolve, 0);
        return;
      }
      w.requestIdleCallback(() => (worldStore.flight.active ? wait() : resolve()), {
        timeout: 600,
      });
    };
    wait();
  });
}

/** Atlases drawn so far, by theme and roles: a station mounting again, or the theme coming back, reuses one */
const atlases = new Map<string, Promise<{ canvas: HTMLCanvasElement; rows: number }>>();

/**
 * Every role's patch in one canvas, `patchColumns` to a row in the order
 * given (role i at column i % patchColumns, row floor(i / patchColumns)).
 * `gentle` (anywhere but the initial warm-up, which wants it at once) draws
 * one patch per idle moment, never during a flight
 */
export function drawPatchAtlas(roles: PatchRole[], theme: WorldTheme, gentle = false) {
  const key = `${theme}|${roles.map((r) => `${r.mission}:${r.initials}:${r.company}`).join('|')}`;
  let atlas = atlases.get(key);
  if (!atlas) {
    atlas = drawAtlas(roles, theme, gentle);
    atlases.set(key, atlas);
    // A failed draw can be tried again
    atlas.catch(() => atlases.delete(key));
  }
  return atlas;
}

async function drawAtlas(roles: PatchRole[], theme: WorldTheme, gentle: boolean) {
  await patchFontsReady();
  const fonts = patchFonts();
  const rows = Math.max(1, Math.ceil(roles.length / patchColumns));
  const atlas = document.createElement('canvas');
  atlas.width = patchColumns * patchSize;
  atlas.height = rows * patchSize;
  const ctx = atlas.getContext('2d');
  for (let i = 0; i < roles.length; i++) {
    if (gentle) await quietMoment();
    const x = (i % patchColumns) * patchSize;
    const y = Math.floor(i / patchColumns) * patchSize;
    ctx?.drawImage(drawPatch(roles[i], i, theme, fonts), x, y);
  }
  return { canvas: atlas, rows };
}
