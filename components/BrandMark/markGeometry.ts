/* ------------------------------------------------------------------
   The LH orbital monogram: bold geometric L and H with a tilted ring
   round them and a moon on it. Depth, front to back: the L, the ring's
   near half (which cuts a gap where it crosses the H), the H, the
   ring's far half. So the ring passes behind the L and in front of the
   H, and the moon slips behind the L as it comes round.
   One geometry for every use: the live header mark (BrandMark.tsx), the
   loading screen, the favicon and app icons (scripts/generate-brand-
   icons.mjs) and the Open Graph cards. No imports and only erasable
   TypeScript: the icon script loads this file directly with Node.
   ------------------------------------------------------------------ */

/** The mark's canvas (SVG user units) */
export const markWidth = 72;
export const markHeight = 52;

/** What the mark actually covers (ring ends and moon included), for tight framing */
export const markBounds = { x: 1, y: 6, width: 70, height: 40 } as const;

/** The ring: centre, radii and tilt (degrees, anticlockwise on screen) */
export const ring = { cx: 36, cy: 26, rx: 33, ry: 9, tilt: -21 } as const;

const degrees = Math.PI / 180;

/**
 * Where the moon sits for each station, as an angle round the ring
 * (radians: 0 at the right end, π/2 front and centre, negative behind).
 * Home is at the left end; the rest run along the front from just past the
 * L's foot up to the right end, so flying Home → About slips the moon behind
 * the L. The 404 is "signal lost": round the back, dimmed.
 */
export const stationSlots: Record<string, number> = {
  home: 180 * degrees,
  about: 94 * degrees,
  experience: 74 * degrees,
  projects: 50 * degrees,
  skills: 25 * degrees,
  contact: 0,
  lost: -90 * degrees,
};

/** The moon on the ring at `angle`, in the ring's own (untilted) frame */
export function moonPoint(angle: number) {
  return {
    x: ring.cx + ring.rx * Math.cos(angle),
    y: ring.cy + ring.ry * Math.sin(angle),
  };
}

type Bar = readonly [x: number, y: number, width: number, height: number];

/** The letters as rounded bars, each letter drawn as one shape */
export const letterL: readonly Bar[] = [
  [14, 12, 7.5, 30],
  [14, 34.5, 18, 7.5],
];
export const letterH: readonly Bar[] = [
  [36.5, 12, 7.5, 30],
  [50.5, 12, 7.5, 30],
  [43, 23.25, 8, 7],
];
export const barRadius = 1.8;
/** Ring and cut widths: the cut is the gap the near half leaves in the H */
export const ringWidth = 2.4;
export const cutWidth = 5.4;

const tiltTransform = `rotate(${ring.tilt} ${ring.cx} ${ring.cy})`;
const { cx, cy, rx, ry } = ring;
/** The ring's far half (over the top, behind the letters) and near half (in front) */
export const backArc = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`;
export const frontArc = `M ${cx + rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx - rx} ${cy}`;
/** The whole ring as a path, for moons that orbit it (clockwise: front first) */
export const orbitPath = `M ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy}`;

/** Fixed colours for uses without the site's CSS (icons, OG cards) */
export const markColors = {
  dark: { violet: '#a78bfa', cyan: '#22d3ee', moon: '#ffffff', ring: '#c7d2fe' },
  light: { violet: '#6d28d9', cyan: '#0e7490', moon: '#0e7490', ring: '#4338ca' },
  /** Readable on light and dark alike, for icons that can't follow the theme (.ico) */
  mid: { violet: '#8b5cf6', cyan: '#06b6d4', moon: '#0891b2', ring: '#818cf8' },
} as const;

/**
 * The mark as a standalone SVG string (icons, OG cards). `background` adds a
 * rounded tile behind it (app icons); `pad` is the margin round the mark as
 * a share of its width; `moon` is the moon's angle (Home by default).
 */
export function brandMarkSvg({
  size = 512,
  background,
  pad = 0.08,
  moon = stationSlots.home,
  theme = 'dark',
  adaptive = false,
  small = false,
  tileRadius = 0.22,
}: {
  size?: number;
  background?: string;
  pad?: number;
  moon?: number;
  theme?: keyof typeof markColors;
  /** Switch to the light colours under prefers-color-scheme: light (favicons) */
  adaptive?: boolean;
  /** For 32px and under: a heavier ring and moon, and no far half */
  small?: boolean;
  /** The background tile's corner radius, as a share of its size */
  tileRadius?: number;
} = {}) {
  const colors = markColors[theme];
  const round = (n: number) => Math.round(n * 100) / 100;
  const span = round(markWidth * (1 + pad * 2));
  const x0 = round((markWidth - span) / 2);
  const y0 = round((markHeight - span) / 2);
  const point = moonPoint(moon);
  const bars = (letter: readonly Bar[]) =>
    letter
      .map(
        ([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${barRadius}"/>`
      )
      .join('');
  const behind = Math.sin(moon) < 0;
  const moonDot = `<circle cx="${point.x}" cy="${point.y}" r="${small ? 4.6 : 3.4}" class="m" fill="${colors.moon}"/>`;
  const ringStroke = small ? 3.8 : ringWidth;
  const cutStroke = small ? 7.4 : cutWidth;
  const style = adaptive
    ? `<style>
        .v{stop-color:${colors.violet}}.c{stop-color:${colors.cyan}}
        .r{stroke:${colors.ring}}.m{fill:${colors.moon}}
        @media (prefers-color-scheme: light){
          .v{stop-color:${markColors.light.violet}}.c{stop-color:${markColors.light.cyan}}
          .r{stroke:${markColors.light.ring}}.m{fill:${markColors.light.moon}}
        }
      </style>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${x0} ${y0} ${span} ${span}">
  ${style}
  <defs>
    <linearGradient id="lh-letters" gradientUnits="userSpaceOnUse" x1="14" y1="12" x2="58" y2="42">
      <stop offset="0" class="v" stop-color="${colors.violet}"/>
      <stop offset="1" class="c" stop-color="${colors.cyan}"/>
    </linearGradient>
    <linearGradient id="lh-ring" gradientUnits="userSpaceOnUse" x1="${cx - rx}" y1="0" x2="${cx + rx}" y2="0">
      <stop offset="0" class="c" stop-color="${colors.cyan}"/>
      <stop offset="1" class="v" stop-color="${colors.violet}"/>
    </linearGradient>
    <mask id="lh-cut" maskUnits="userSpaceOnUse" x="${x0}" y="${y0}" width="${span}" height="${span}">
      <rect x="${x0}" y="${y0}" width="${span}" height="${span}" fill="#fff"/>
      <path d="${frontArc}" transform="${tiltTransform}" fill="none" stroke="#000" stroke-width="${cutStroke}"/>
    </mask>
  </defs>
  ${background ? `<rect x="${x0}" y="${y0}" width="${span}" height="${span}" rx="${span * tileRadius}" fill="${background}"/>` : ''}
  <g transform="${tiltTransform}">
    ${small ? '' : `<path d="${backArc}" fill="none" class="r" stroke="${colors.ring}" stroke-opacity="0.45" stroke-width="1.8"/>`}
    ${behind ? moonDot : ''}
  </g>
  <g fill="url(#lh-letters)" mask="url(#lh-cut)">${bars(letterH)}</g>
  <g transform="${tiltTransform}">
    <path d="${frontArc}" fill="none" stroke="url(#lh-ring)" stroke-width="${ringStroke}" stroke-linecap="round"/>
    ${behind ? '' : moonDot}
  </g>
  <g fill="url(#lh-letters)">${bars(letterL)}</g>
</svg>`;
}
