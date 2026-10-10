'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  MathUtils,
  NormalBlending,
  RepeatWrapping,
  ShaderMaterial,
  Vector3,
} from 'three';

import { quadCorners, quadIndex } from './Starfield';
import { navigableStations, stationPositions } from './routes';
import { sunDirection } from './sky';
import { palettes, seededRandom, setUniform } from './utils';

import type { InstancedBufferGeometry } from 'three';
import type { QualityTier } from './quality';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Gas along the lanes between the stations: soft, wispy clouds of
   glowing hydrogen (pink) and oxygen (teal), placed beside the line
   each flight takes, so a flight passes through and alongside them
   with real parallax rather than only against the painted sky. Each is
   a camera-facing quad textured with a small baked noise tile (turned
   and offset per cloud), brighter on the side towards the sun. They
   fade out as the camera comes close (no flat wall flying through them)
   and into the distance, keep clear of every station's own framing, and
   stay well under the bloom threshold so bloom never smears them.
   ------------------------------------------------------------------ */

/** Clouds keep at least this far from a station's centre (its pages are framed from ~11 out) */
const clearance = 24;

/** A tileable fbm value-noise tile, baked once on a canvas */
function noiseTile() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  if (!ctx) return texture;
  const random = seededRandom(97);
  const value = (cells: number) => {
    const grid = Array.from({ length: cells * cells }, () => random());
    return (x: number, y: number) => {
      const gx = (x / size) * cells;
      const gy = (y / size) * cells;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const at = (i: number, j: number) => grid[((j % cells) * cells + (i % cells)) % grid.length];
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const top = MathUtils.lerp(at(x0, y0), at(x0 + 1, y0), sx);
      const bottom = MathUtils.lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx);
      return MathUtils.lerp(top, bottom, sy);
    };
  };
  const octaves = [4, 8, 16, 32].map(value);
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let n = 0;
      let amplitude = 0.5;
      for (const octave of octaves) {
        n += octave(x, y) * amplitude;
        amplitude *= 0.5;
      }
      const v = Math.round(MathUtils.clamp(n / 0.9375, 0, 1) * 255);
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** Where the clouds sit: beside each lane from one station to the next, never on a station */
function placeClouds(count: number) {
  const random = seededRandom(61);
  const centres = new Float32Array(count * 3);
  const looks = new Float32Array(count * 4);
  const lanes = navigableStations.slice(1).map((key, i) => [navigableStations[i], key] as const);
  const from = new Vector3();
  const to = new Vector3();
  const point = new Vector3();
  const side = new Vector3();
  const up = new Vector3(0, 1, 0);
  let placed = 0;
  for (let attempt = 0; placed < count && attempt < count * 20; attempt++) {
    const [a, b] = lanes[attempt % lanes.length];
    from.fromArray(stationPositions[a]);
    to.fromArray(stationPositions[b]);
    point.lerpVectors(from, to, 0.15 + random() * 0.7);
    side.subVectors(to, from).cross(up).normalize();
    // Beside the lane, a little above or below it: flights pass through the edges
    point
      .addScaledVector(side, (random() - 0.5) * 2 * (8 + random() * 22))
      .addScaledVector(up, (random() - 0.5) * 24);
    const tooClose = navigableStations.some(
      (key) => point.distanceTo(from.fromArray(stationPositions[key])) < clearance
    );
    if (tooClose) continue;
    point.toArray(centres, placed * 3);
    // Size, turn, which gas (0 hydrogen, 1 oxygen), brightness
    looks.set(
      [18 + random() * 22, random() * Math.PI * 2, random(), 0.6 + random() * 0.4],
      placed * 4
    );
    placed++;
  }
  return { centres, looks, placed };
}

const vertexShader = /* glsl */ `
  uniform vec3 uSun;
  attribute vec3 aCentre;
  attribute vec4 aLook;
  varying vec2 vUv;
  varying vec2 vSun;
  varying float vKind;
  varying float vFade;
  varying vec2 vShift;
  varying float vBright;
  void main() {
    vec4 centre = modelViewMatrix * vec4(aCentre, 1.0);
    float size = aLook.x;
    float c = cos(aLook.y);
    float s = sin(aLook.y);
    vec2 corner = mat2(c, s, -s, c) * position.xy;
    vUv = corner;
    // The sun's direction across the quad, for which side is lit
    vSun = normalize(mat2(c, s, -s, c) * (uSun.xy + 1e-4));
    vKind = aLook.z;
    vBright = aLook.w;
    vShift = aCentre.xz * 0.013;
    float distance = -centre.z;
    // Gone as the camera comes close (no wall to fly through) and into the haze
    vFade = smoothstep(size * 0.25, size * 0.9, length(centre.xyz)) * (1.0 - smoothstep(110.0, 190.0, distance));
    centre.xy += position.xy * size * 0.5;
    gl_Position = projectionMatrix * centre;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uNoise;
  uniform vec3 uHydrogen;
  uniform vec3 uOxygen;
  uniform float uStrength;
  varying vec2 vUv;
  varying vec2 vSun;
  varying float vKind;
  varying float vFade;
  varying vec2 vShift;
  varying float vBright;
  void main() {
    float r = length(vUv);
    if (r > 1.0 || vFade < 0.01) discard;
    vec2 at = vUv * 0.5 + vShift;
    float n = texture2D(uNoise, at).r * 0.65 + texture2D(uNoise, at * 2.3 + 0.37).r * 0.35;
    float body = smoothstep(1.0, 0.15, r) * smoothstep(0.32, 0.85, n + (1.0 - r) * 0.25);
    float lit = 0.65 + 0.35 * dot(vUv, vSun);
    vec3 gas = mix(uHydrogen, uOxygen, smoothstep(0.35, 0.65, vKind + (n - 0.5) * 0.5));
    float alpha = body * vFade * uStrength * vBright;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(gas * lit, alpha);
  }
`;

const sunView = new Vector3();

export function GasClouds({
  count,
  theme,
  tier,
}: {
  count: number;
  theme: WorldTheme;
  tier: QualityTier;
}) {
  const geometryRef = useRef<InstancedBufferGeometry>(null);
  const { centres, looks, placed } = useMemo(() => placeClouds(count), [count]);
  const noise = useMemo(() => noiseTile(), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uNoise: { value: noise },
          uSun: { value: new Vector3() },
          uHydrogen: { value: new Color() },
          uOxygen: { value: new Color() },
          uStrength: { value: 0.1 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    [noise]
  );
  useEffect(
    () => () => {
      material.dispose();
      noise.dispose();
    },
    [material, noise]
  );
  useEffect(() => tint(material, theme), [material, theme]);

  useFrame(({ camera }) => {
    // The sun's direction as seen from the camera, for each cloud's lit side
    sunView.copy(sunDirection).transformDirection(camera.matrixWorldInverse);
    setUniform(material, 'uSun', sunView);
    // The bottom tier draws half of them: big soft quads are what it can least afford
    const geometry = geometryRef.current;
    if (geometry) geometry.instanceCount = tier === 'low' ? Math.ceil(placed / 2) : placed;
  });

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-2}>
      {/* New per count: three caps an instanced geometry at the attribute size it first drew */}
      <instancedBufferGeometry key={count} ref={geometryRef} instanceCount={placed}>
        <bufferAttribute attach="attributes-position" args={[quadCorners, 3]} />
        <bufferAttribute attach="index" args={[quadIndex, 1]} />
        <instancedBufferAttribute attach="attributes-aCentre" args={[centres, 3]} />
        <instancedBufferAttribute attach="attributes-aLook" args={[looks, 4]} />
      </instancedBufferGeometry>
    </mesh>
  );
}

/** Glowing gas on the dark sky; pale, thin wisps over daylight's */
function tint(material: ShaderMaterial, theme: WorldTheme) {
  const palette = palettes[theme];
  const dark = theme === 'dark';
  setUniform(
    material,
    'uHydrogen',
    new Color(dark ? '#d9468f' : palette.pink).multiplyScalar(dark ? 0.55 : 1)
  );
  setUniform(
    material,
    'uOxygen',
    new Color(dark ? '#1fb5c9' : palette.cyan).multiplyScalar(dark ? 0.5 : 1)
  );
  setUniform(material, 'uStrength', dark ? 0.16 : 0.07);
  material.blending = dark ? AdditiveBlending : NormalBlending;
  material.needsUpdate = true;
}
