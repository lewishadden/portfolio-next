'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, MathUtils, NormalBlending, ShaderMaterial } from 'three';

import { cameraMotion } from './MotionProbe';
import { palettes, seededRandom, setUniform } from './utils';
import { worldStore } from './worldStore';

import type { InstancedBufferGeometry } from 'three';

import type { WorldTheme } from './utils';

const center = [0, 0, -110];

/** A unit quad (two triangles), drawn once per star or mote and stretched in the vertex shader */
export const quadCorners = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
export const quadIndex = new Uint16Array([0, 1, 2, 0, 2, 3]);

/**
 * Lays a quad out in screen space: a round sprite of `radius` pixels at the
 * head, stretched back along `dir` by `trail` pixels into a streak. The
 * fragment shader gets its own position along and across it (`vLocal`).
 */
export const streakQuad = /* glsl */ `
  varying vec2 vLocal;
  varying float vRadius;
  varying float vLength;
  vec4 streak(vec4 clip, vec2 dir, float radius, float trail, vec2 halfSize) {
    float along = position.x < 0.0 ? -(trail + radius) : radius;
    float across = position.y * radius;
    vec2 offset = dir * along + vec2(-dir.y, dir.x) * across;
    clip.xy += offset / halfSize * clip.w;
    vLocal = vec2(along, across);
    vRadius = radius;
    vLength = trail;
    return clip;
  }
`;

/** Distance from the streak's spine, 0 on it and 0.5 at its edge, like gl_PointCoord's */
export const streakShape = /* glsl */ `
  varying vec2 vLocal;
  varying float vRadius;
  varying float vLength;
  float streakDistance() {
    float beyond = vLocal.x - clamp(vLocal.x, -vLength, 0.0);
    return 0.5 * length(vec2(beyond, vLocal.y)) / vRadius;
  }
  // Brightest at the head, fading down the tail
  float streakFade() {
    float tail = vLength > 0.0 ? clamp(-vLocal.x / vLength, 0.0, 1.0) : 0.0;
    return (1.0 - 0.8 * tail) * mix(1.0, 0.45, smoothstep(0.0, 80.0, vLength));
  }
`;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uWarp;
  uniform float uStreak;
  uniform vec2 uFocus;
  uniform vec2 uResolution;
  attribute vec3 aCenter;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vTwinkle;
  ${streakQuad}
  void main() {
    vec4 mv = modelViewMatrix * vec4(aCenter, 1.0);
    vec4 clip = projectionMatrix * mv;
    vTwinkle = 0.55 + 0.45 * sin(uTime * (0.4 + aPhase * 1.6) + aPhase * 6.2831);
    vColor = aColor;
    float radius = 0.5 * aSize * uPixelRatio * (1.0 + 0.3 * uWarp) * (340.0 / -mv.z);
    // At speed every star streams out from the point the camera is heading
    // for, the further out the longer its streak
    vec2 halfSize = 0.5 * uResolution;
    vec2 away = (clip.xy / clip.w - uFocus) * halfSize;
    float reach = length(away);
    vec2 dir = reach > 0.001 ? away / reach : vec2(1.0, 0.0);
    gl_Position = streak(clip, dir, radius, uStreak * reach * 0.16, halfSize);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vTwinkle;
  ${streakShape}
  void main() {
    float core = smoothstep(0.5, 0.0, streakDistance());
    float alpha = (pow(core, 3.0) + core * 0.25) * vTwinkle * uOpacity * streakFade();
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor * 1.4, alpha);
  }
`;

/**
 * True star colours (blackbody, O through M) for the night sky, weighted
 * roughly as naked-eye stars appear: mostly white and pale yellow, a
 * few blue giants, more orange and red than you'd expect.
 */
const spectral: [string, number][] = [
  ['#9bb0ff', 0.06],
  ['#aabfff', 0.1],
  ['#cad7ff', 0.16],
  ['#f8f7ff', 0.24],
  ['#fff4ea', 0.2],
  ['#ffd2a1', 0.15],
  ['#ffb56c', 0.09],
];

function pickSpectral(r: number) {
  let total = 0;
  for (const [colour, weight] of spectral) {
    total += weight;
    if (r < total) return colour;
  }
  return spectral[spectral.length - 1][0];
}

function applyStarTheme(material: ShaderMaterial, colors: Float32Array, theme: WorldTheme) {
  const palette = palettes[theme];
  material.blending = palette.additive ? AdditiveBlending : NormalBlending;
  material.needsUpdate = true;
  setUniform(material, 'uOpacity', palette.starOpacity);
  const tints = palette.stars.map((c) => new Color(c));
  const tint = new Color();
  const random = seededRandom(11);
  for (let i = 0; i < colors.length / 3; i++) {
    const r = random();
    if (theme === 'dark') tint.set(pickSpectral(r));
    else tint.copy(r < 0.7 ? tints[0] : r < 0.86 ? tints[1] : tints[2]);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
}

/** How far the stars streak, 0..1: only at speed, and only heading into the view */
export const streakAmount = () =>
  MathUtils.smoothstep(cameraMotion.speed, 30, 120) *
  MathUtils.smoothstep(cameraMotion.ahead, 0.15, 0.6);

/**
 * Twinkling star shell enclosing every station. At speed the stars stream
 * into streaks out from the point the camera is heading for (the jump to
 * lightspeed); each is a small quad, round at rest
 */
export function Starfield({ count, theme }: { count: number; theme: WorldTheme }) {
  const geometryRef = useRef<InstancedBufferGeometry>(null);

  const { positions, sizes, phases, colors } = useMemo(() => {
    const random = seededRandom(7);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = random() * 2 - 1;
      const theta = random() * Math.PI * 2;
      const radius = 220 + Math.pow(random(), 0.7) * 320;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = center[0] + radius * s * Math.cos(theta);
      positions[i * 3 + 1] = center[1] + radius * u * 0.7;
      positions[i * 3 + 2] = center[2] + radius * s * Math.sin(theta);
      sizes[i] = 0.8 + Math.pow(random(), 4) * 4.2;
      phases[i] = random();
    }
    return { positions, sizes, phases, colors };
  }, [count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uWarp: { value: 0 },
          uStreak: { value: 0 },
          uFocus: { value: [0, 0] },
          uResolution: { value: [1, 1] },
          uOpacity: { value: 1 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
      }),
    []
  );

  useEffect(() => {
    applyStarTheme(material, colors, theme);
    const attribute = geometryRef.current?.getAttribute('aColor');
    if (attribute) attribute.needsUpdate = true;
  }, [material, colors, theme]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock, gl, size, viewport }) => {
    setUniform(material, 'uTime', clock.elapsedTime);
    setUniform(material, 'uPixelRatio', viewport.dpr);
    setUniform(material, 'uWarp', Math.min(worldStore.velocity / 40, 1.4));
    trackStreaks(material, size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
  });

  return (
    <mesh material={material} frustumCulled={false}>
      <instancedBufferGeometry ref={geometryRef} instanceCount={count}>
        <bufferAttribute attach="attributes-position" args={[quadCorners, 3]} />
        <bufferAttribute attach="index" args={[quadIndex, 1]} />
        <instancedBufferAttribute attach="attributes-aCenter" args={[positions, 3]} />
        <instancedBufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <instancedBufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <instancedBufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </instancedBufferGeometry>
    </mesh>
  );
}

/** Streak length and where they stream from, and the drawing buffer's size in pixels */
function trackStreaks(material: ShaderMaterial, width: number, height: number) {
  setUniform(material, 'uStreak', streakAmount());
  const focus = material.uniforms.uFocus.value as number[];
  focus[0] = cameraMotion.focusX;
  focus[1] = cameraMotion.focusY;
  const resolution = material.uniforms.uResolution.value as number[];
  resolution[0] = width;
  resolution[1] = height;
}

/* ------------------------------------------------------------------
   The brightest stars, with diffraction spikes: four long, thin rays
   at the same orientation for every star (they come from the optics,
   not the star), plus a faint second pair, as in telescope images. Each
   is a quad on the same streak layout as the star shell: at rest it is
   the spike sprite, and at speed it narrows to its core and streams out
   with the rest of the stars.
   ------------------------------------------------------------------ */
const spikeVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uStreak;
  uniform vec2 uFocus;
  uniform vec2 uResolution;
  attribute vec3 aCenter;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vTwinkle;
  varying vec2 vSpike;
  varying float vStreaking;
  ${streakQuad}
  void main() {
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(aCenter, 1.0);
    vColor = aColor;
    vTwinkle = 0.85 + 0.15 * sin(uTime * (0.6 + aPhase) + aPhase * 6.2831);
    vec2 halfSize = 0.5 * uResolution;
    vec2 away = (clip.xy / clip.w - uFocus) * halfSize;
    float reach = length(away);
    vec2 dir = reach > 0.001 ? away / reach : vec2(1.0, 0.0);
    // At rest the quad is the whole spike sprite, aSize pixels across;
    // streaking, it narrows to the star's core
    float rest = 0.5 * aSize * uPixelRatio;
    vStreaking = smoothstep(0.0, 0.3, uStreak);
    float radius = mix(rest, 2.5 * uPixelRatio, vStreaking);
    gl_Position = streak(clip, dir, radius, uStreak * reach * 0.16, halfSize);
    // Where on the sprite this corner lies, screen-aligned and -0.5..0.5
    // across it at rest (as gl_PointCoord was), so every star's spikes
    // keep one orientation whichever way it would streak
    vSpike = (dir * vLocal.x + vec2(-dir.y, dir.x) * vLocal.y) / (2.0 * rest);
  }
`;

const spikeFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vTwinkle;
  varying vec2 vSpike;
  varying float vStreaking;
  ${streakShape}
  void main() {
    vec2 p = vSpike;
    float r = length(p);
    float core = exp(-r * r * 900.0) * 2.4 + exp(-r * 26.0) * 0.35;
    float main = exp(-abs(p.x) * 260.0) + exp(-abs(p.y) * 260.0);
    vec2 q = vec2(p.x + p.y, p.x - p.y) * 0.7071;
    float second = (exp(-abs(q.x) * 420.0) + exp(-abs(q.y) * 420.0)) * 0.35;
    float spikes = (main + second) * smoothstep(0.5, 0.0, r) * (1.0 - smoothstep(0.0, 0.5, r) * 0.6);
    // Streaking: a bright line like the shell's stars, a little hotter
    float line = smoothstep(0.5, 0.0, streakDistance());
    float trail = (line * line * line + line * 0.25) * 2.0 * streakFade();
    float intensity = mix(core + spikes * 0.55, trail, vStreaking) * vTwinkle * uOpacity;
    if (intensity < 0.004) discard;
    gl_FragColor = vec4(vColor * intensity, min(intensity, 1.0));
  }
`;

/**
 * The brightest stars, each with diffraction spikes. Always mounted (hidden
 * on the light sky, which daylight would wash them out of), so their shader
 * compiles with the rest of the world's before the first frame, never on a
 * switch to the dark theme
 */
export function BrightStars({ count, theme }: { count: number; theme: WorldTheme }) {
  const { positions, sizes, phases, colors } = useMemo(() => {
    const random = seededRandom(31);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const tint = new Color();
    for (let i = 0; i < count; i++) {
      const u = random() * 2 - 1;
      const theta = random() * Math.PI * 2;
      const radius = 600;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = center[0] + radius * s * Math.cos(theta);
      positions[i * 3 + 1] = center[1] + radius * u * 0.8;
      positions[i * 3 + 2] = center[2] + radius * s * Math.sin(theta);
      sizes[i] = 26 + Math.pow(random(), 3) * 42;
      phases[i] = random();
      tint.set(pickSpectral(random()));
      colors.set([tint.r, tint.g, tint.b], i * 3);
    }
    return { positions, sizes, phases, colors };
  }, [count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uStreak: { value: 0 },
          uFocus: { value: [0, 0] },
          uResolution: { value: [1, 1] },
          uOpacity: { value: 1 },
        },
        vertexShader: spikeVertex,
        fragmentShader: spikeFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock, gl, size, viewport }) => {
    setUniform(material, 'uTime', clock.elapsedTime);
    setUniform(material, 'uPixelRatio', viewport.dpr);
    trackStreaks(material, size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
  });

  // Daylight hides them
  return (
    <mesh material={material} frustumCulled={false} visible={theme === 'dark'}>
      <instancedBufferGeometry instanceCount={count}>
        <bufferAttribute attach="attributes-position" args={[quadCorners, 3]} />
        <bufferAttribute attach="index" args={[quadIndex, 1]} />
        <instancedBufferAttribute attach="attributes-aCenter" args={[positions, 3]} />
        <instancedBufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <instancedBufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <instancedBufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </instancedBufferGeometry>
    </mesh>
  );
}
