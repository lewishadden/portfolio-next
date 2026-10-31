'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';

import { motionLevel } from '@/utils/motion';

import { applyGlowTheme, asGlow } from './materials';
import { quadCorners, quadIndex, streakQuad, streakShape } from './Starfield';
import { seededRandom } from './utils';

import type { Mesh, WebGLRenderer } from 'three';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Sparks thrown off where free roam's ship knocks a hull: a burst of
   short-lived streaks from the contact point, flying back off the
   surface the way the ship came in (its velocity reflected) with some
   scatter, slowing as they go and cooling from white-hot to orange.
   A pool of 24 in one instanced draw, laid out by the stars' streak
   quad; always mounted (compiled in the warm-up), drawn only while a
   spark is alive. Full motion only: below it a knock still pings.
   ------------------------------------------------------------------ */

const pool = 24;
/** Sparks per knock, and how long each lives (s) */
const burst = 10;
const life = 0.5;

interface Burst {
  point: Vector3;
  normal: Vector3;
  velocity: Vector3;
  strength: number;
}

const queue: Burst[] = [];

/**
 * A knock at `point` on a surface facing `normal`, the ship coming in at
 * `velocity` (before it bounced): sparks fly. Nothing below full motion
 */
export function spawnSparks(point: Vector3, normal: Vector3, velocity: Vector3, strength = 1) {
  if (motionLevel() !== 'full' || queue.length > 4) return;
  queue.push({
    point: point.clone(),
    normal: normal.clone(),
    velocity: velocity.clone(),
    strength,
  });
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2 uResolution;
  attribute vec3 aStart;
  attribute vec3 aVelocity;
  attribute float aBorn;
  varying float vAge;
  ${streakQuad}
  // Where a spark is t seconds out: it slows as it goes
  vec3 sparkAt(float t) {
    return aStart + aVelocity * (t - 0.6 * t * t);
  }
  void main() {
    float t = uTime - aBorn;
    vAge = t / ${life.toFixed(2)};
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(sparkAt(t), 1.0);
    vec4 back = projectionMatrix * modelViewMatrix * vec4(sparkAt(max(t - 0.045, 0.0)), 1.0);
    // Dead, unborn or behind the camera: off the screen
    if (vAge < 0.0 || vAge >= 1.0 || clip.w < 0.05 || back.w < 0.05) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec2 halfSize = 0.5 * uResolution;
    vec2 travel = (clip.xy / clip.w - back.xy / back.w) * halfSize;
    float trail = length(travel);
    vec2 dir = trail > 0.001 ? travel / trail : vec2(1.0, 0.0);
    float radius = 1.4 * uPixelRatio;
    gl_Position = streak(clip, dir, radius, min(trail, 160.0 * uPixelRatio), halfSize);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uHot;
  uniform vec3 uCool;
  uniform float uLight;
  varying float vAge;
  ${streakShape}
  void main() {
    float core = smoothstep(0.5, 0.0, streakDistance());
    float fade = 1.0 - clamp(vAge, 0.0, 1.0);
    float alpha = core * fade * fade * streakFade();
    if (alpha < 0.01) discard;
    vec3 color = mix(uHot, uCool, clamp(vAge * 1.6, 0.0, 1.0));
    gl_FragColor = vec4(color * mix(2.2, 1.0, uLight), min(alpha, 1.0));
  }
`;

const tones: Record<WorldTheme, { hot: string; cool: string }> = {
  dark: { hot: '#fff4d1', cool: '#fb923c' },
  light: { hot: '#ea580c', cool: '#9a3412' },
};

function createMaterial() {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uResolution: { value: new Vector2(1, 1) },
        uHot: { value: new Color() },
        uCool: { value: new Color() },
        uLight: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })
  );
}

function createGeometry() {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(quadCorners, 3));
  geometry.setIndex(new BufferAttribute(quadIndex, 1));
  geometry.setAttribute('aStart', new InstancedBufferAttribute(new Float32Array(pool * 3), 3));
  geometry.setAttribute('aVelocity', new InstancedBufferAttribute(new Float32Array(pool * 3), 3));
  // Born long ago: every slot starts dead
  geometry.setAttribute(
    'aBorn',
    new InstancedBufferAttribute(new Float32Array(pool).fill(-1000), 1)
  );
  geometry.instanceCount = pool;
  return geometry;
}

function paint(material: ShaderMaterial, theme: WorldTheme) {
  (material.uniforms.uHot.value as Color).set(tones[theme].hot);
  (material.uniforms.uCool.value as Color).set(tones[theme].cool);
  applyGlowTheme(material, theme);
}

const random = seededRandom(97);
const reflected = new Vector3();
const scatter = new Vector3();
const drawingSize = new Vector2();

interface SparkState {
  next: number;
  /** Clock time the last spark dies */
  liveUntil: number;
}

/** Lays this frame's bursts into the pool, round-robin */
function release(geometry: InstancedBufferGeometry, state: SparkState, t: number) {
  if (!queue.length) return;
  const starts = geometry.getAttribute('aStart') as InstancedBufferAttribute;
  const velocities = geometry.getAttribute('aVelocity') as InstancedBufferAttribute;
  const born = geometry.getAttribute('aBorn') as InstancedBufferAttribute;
  while (queue.length) {
    const knock = queue.shift()!;
    // Back off the surface the way the ship came in
    const { velocity, normal } = knock;
    reflected
      .copy(velocity)
      .addScaledVector(normal, -2 * velocity.dot(normal))
      .multiplyScalar(0.55);
    const speed = 5 + 9 * knock.strength;
    for (let i = 0; i < burst; i++) {
      const slot = state.next;
      state.next = (slot + 1) % pool;
      scatter
        .set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1)
        .normalize()
        .multiplyScalar(speed * (0.35 + random() * 0.65))
        .addScaledVector(normal, speed * 0.6)
        .add(reflected);
      starts.setXYZ(slot, knock.point.x, knock.point.y, knock.point.z);
      velocities.setXYZ(slot, scatter.x, scatter.y, scatter.z);
      // A few go a beat later, so the burst crackles rather than pops
      born.setX(slot, t + (i % 3) * 0.03);
    }
    state.liveUntil = t + life + 0.1;
  }
  starts.needsUpdate = true;
  velocities.needsUpdate = true;
  born.needsUpdate = true;
}

function step(
  mesh: Mesh,
  geometry: InstancedBufferGeometry,
  material: ShaderMaterial,
  state: SparkState,
  gl: WebGLRenderer,
  t: number
) {
  release(geometry, state, t);
  const live = t < state.liveUntil;
  mesh.visible = live;
  if (!live) return;
  material.uniforms.uTime.value = t;
  material.uniforms.uPixelRatio.value = gl.getPixelRatio();
  (material.uniforms.uResolution.value as Vector2).copy(gl.getDrawingBufferSize(drawingSize));
}

/** Free roam: sparks where the ship knocks a hull (spawnSparks). Mount after ExploreControls */
export function Sparks({ theme }: { theme: WorldTheme }) {
  const meshRef = useRef<Mesh>(null);
  const state = useRef<SparkState>({ next: 0, liveUntil: -1 });
  const material = useMemo(() => createMaterial(), []);
  const geometry = useMemo(() => createGeometry(), []);
  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry]
  );
  useEffect(() => paint(material, theme), [material, theme]);

  useFrame(({ clock, gl }) => {
    const mesh = meshRef.current;
    if (mesh) step(mesh, geometry, material, state.current, gl, clock.elapsedTime);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={21}
    />
  );
}
