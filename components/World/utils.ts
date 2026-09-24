import { Color, ShaderMaterial, Vector3 } from 'three';

/** Deterministic PRNG (mulberry32) so procedural layouts are pure and stable across renders */
export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform writes live outside components so per-frame mutation stays out of render */
export function setUniform(material: ShaderMaterial, name: string, value: unknown) {
  const uniform = material.uniforms[name];
  if (!uniform) return;
  if (uniform.value instanceof Color && (typeof value === 'string' || value instanceof Color)) {
    uniform.value.set(value);
  } else {
    uniform.value = value;
  }
}

export function latLngToVector3(lat: number, lng: number, radius: number, out = new Vector3()) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return out.set(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export type WorldTheme = 'dark' | 'light';

export interface WorldPalette {
  background: string;
  fog: [number, number];
  stars: [string, string, string];
  starOpacity: number;
  additive: boolean;
  nebula: [string, string, string];
  nebulaStrength: number;
  violet: string;
  cyan: string;
  pink: string;
  ambient: number;
  key: number;
  bloom: number;
  bloomThreshold: number;
  vignette: number;
}

export const palettes: Record<WorldTheme, WorldPalette> = {
  dark: {
    background: '#05060d',
    fog: [26, 120],
    stars: ['#ffffff', '#c4b5fd', '#67e8f9'],
    starOpacity: 1,
    additive: true,
    nebula: ['#3b1a8a', '#0b5f78', '#7a1f5c'],
    nebulaStrength: 0.62,
    violet: '#8b5cf6',
    cyan: '#22d3ee',
    pink: '#f472b6',
    ambient: 0.45,
    key: 1.6,
    bloom: 1.05,
    bloomThreshold: 0.32,
    vignette: 0.62,
  },
  light: {
    background: '#eef0f8',
    fog: [30, 130],
    stars: ['#4c1d95', '#0e7490', '#312e81'],
    starOpacity: 0.55,
    additive: false,
    nebula: ['#c9b8ff', '#9be8f5', '#f9c6e2'],
    nebulaStrength: 0.75,
    violet: '#7c3aed',
    cyan: '#0891b2',
    pink: '#db2777',
    ambient: 1.1,
    key: 2.1,
    bloom: 0.45,
    bloomThreshold: 0.85,
    vignette: 0.18,
  },
};
