'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  InstancedBufferAttribute,
  Matrix4,
  NormalBlending,
  ShaderMaterial,
} from 'three';

import { motionLevel } from '@/utils/motion';

import { stationKeys, stationPositions } from './routes';
import { palettes } from './utils';
import { emitCue, onFlight, worldStore } from './worldStore';

import type { InstancedMesh } from 'three';
import type { StationKey } from './routes';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Click feedback in 3D: wherever a click lands on something in the
   world, a ring of light pings out from that point (two rings, a beat
   apart, facing the camera) and the 'ping' cue sounds. A small pool,
   one instanced draw, always mounted so it is compiled with the rest.
   The same pool sends a wide ring out round a station as a long flight
   arrives, timed with its power surge (no flash at its centre). Pings
   age only on frames that are drawn, so the pool asks for frames itself
   while one is under way: at the still level the canvas draws on demand,
   and a ping nothing else redrew for froze on its first frame.
   ------------------------------------------------------------------ */

const pool = 8;
/** Seconds a ping lasts */
const lifetime = 0.9;

export interface PingOptions {
  /** Size against a click's ping (1) */
  scale?: number;
  /** Seconds before it starts */
  delay?: number;
  /** Seconds it lasts */
  life?: number;
  /** The bright flash at its centre (clicks have one) */
  flash?: boolean;
  /** Sound the 'ping' cue (default true) */
  cue?: boolean;
}

interface Queued {
  at: [number, number, number];
  scale: number;
  delay: number;
  life: number;
  flash: boolean;
}

const queue: Queued[] = [];

/** Asks the canvas for a frame (the mounted pool's invalidate): a new ping draws even on demand */
let wake: (() => void) | null = null;

type Point = { x: number; y: number; z: number } | readonly [number, number, number];

const toArray = (point: Point): [number, number, number] =>
  'x' in point ? [point.x, point.y, point.z] : [point[0], point[1], point[2]];

/** Pings out from a point in world space (an R3F event's `e.point`, or x, y, z) */
export function spawnPing(point: Point, options: PingOptions = {}) {
  const at = toArray(point);
  queue.push({
    at,
    scale: options.scale ?? 1,
    delay: options.delay ?? 0,
    life: options.life ?? lifetime,
    flash: options.flash ?? true,
  });
  wake?.();
  if (options.cue ?? true) emitCue('ping', { at });
}

/** Flights at least this long (seconds) end with the arrival ring */
const ringAfter = 2;
/** The power-on's surge starts this long after the approach (power.tsx) */
const surgeDelay = 0.42;

/** A long flight's final approach: a wide ring out round the station, with its surge */
function arrivalRing(event: string, to: string) {
  if (event !== 'approach' || worldStore.flight.duration <= ringAfter) return;
  if (motionLevel() !== 'full' || !stationKeys.includes(to as StationKey)) return;
  spawnPing(stationPositions[to as StationKey], {
    scale: 7,
    delay: surgeDelay,
    life: 1.6,
    flash: false,
    cue: false,
  });
}

const vertexShader = /* glsl */ `
  attribute float aAge;
  attribute float aScale;
  attribute float aFlash;
  varying vec2 vUv;
  varying float vAge;
  varying float vScale;
  varying float vFlash;
  void main() {
    vUv = position.xy;
    vAge = aAge;
    vScale = aScale;
    vFlash = aFlash;
    // Faces the camera: the quad is laid out in view space round its centre
    vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float grow = 1.0 - pow(1.0 - clamp(aAge, 0.0, 1.0), 3.0);
    centre.xy += position.xy * mix(0.12, 1.5, grow) * aScale;
    gl_Position = projectionMatrix * centre;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLight;
  varying vec2 vUv;
  varying float vAge;
  varying float vScale;
  varying float vFlash;
  void main() {
    // Done, or waiting to start
    if (vAge >= 1.0 || vAge < 0.0) discard;
    float d = length(vUv);
    // Wider rings keep a slimmer band
    float sharp = sqrt(vScale);
    float ring = exp(-pow((d - 0.82) * 14.0 * sharp, 2.0));
    // A second, fainter ring follows a beat behind, and (clicks) a flash at the start
    float inner = exp(-pow((d - 0.82 * smoothstep(0.15, 1.0, vAge)) * 18.0 * sharp, 2.0)) * 0.5;
    float flash = exp(-d * d * 30.0) * (1.0 - smoothstep(0.0, 0.25, vAge)) * 1.5 * vFlash;
    float fade = 1.0 - vAge;
    float alpha = (ring + inner + flash) * fade * fade * mix(0.55, 1.0, vFlash);
    if (alpha < 0.004) discard;
    vec3 color = mix(uColor, vec3(1.0), flash * 0.5);
    gl_FragColor = vec4(color * mix(2.4, 1.0, uLight), min(alpha, 1.0));
  }
`;

const placed = new Matrix4();

export function Pings({ theme }: { theme: WorldTheme }) {
  const meshRef = useRef<InstancedMesh>(null);
  const state = useRef(createPool());
  const palette = palettes[theme];
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    wake = invalidate;
    return () => {
      if (wake === invalidate) wake = null;
    };
  }, [invalidate]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color() }, uLight: { value: 0 } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => paint(material, palette.cyan, theme), [material, palette.cyan, theme]);
  useEffect(() => onFlight(arrivalRing), []);

  const attributes = useMemo(
    () => ({
      ages: new InstancedBufferAttribute(new Float32Array(pool).fill(1), 1),
      scales: new InstancedBufferAttribute(new Float32Array(pool).fill(1), 1),
      flashes: new InstancedBufferAttribute(new Float32Array(pool).fill(1), 1),
    }),
    []
  );

  useFrame((frame, delta) => {
    const mesh = meshRef.current;
    // Drawn on demand (still), a ping under way asks for its next frame
    if (mesh && step(mesh, state.current, attributes, Math.min(delta, 0.05))) frame.invalidate();
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, material, pool]}
      frustumCulled={false}
      renderOrder={20}
    >
      <planeGeometry args={[2, 2]}>
        <primitive object={attributes.ages} attach="attributes-aAge" />
        <primitive object={attributes.scales} attach="attributes-aScale" />
        <primitive object={attributes.flashes} attach="attributes-aFlash" />
      </planeGeometry>
    </instancedMesh>
  );
}

interface PoolState {
  next: number;
  /** Per slot: 0..1 through its life, below 0 while it waits to start, 1 when free */
  ages: Float32Array;
  /** Seconds each slot's ping lasts */
  lives: Float32Array;
}

const createPool = (): PoolState => ({
  next: 0,
  ages: new Float32Array(pool).fill(1),
  lives: new Float32Array(pool).fill(lifetime),
});

function paint(material: ShaderMaterial, color: string, theme: WorldTheme) {
  (material.uniforms.uColor.value as Color).set(color);
  material.uniforms.uLight.value = theme === 'light' ? 1 : 0;
  material.blending = theme === 'light' ? NormalBlending : AdditiveBlending;
  material.needsUpdate = true;
}

/** Moves the pool on by `dt`: true while a ping is still under way (or waiting to start) */
function step(
  mesh: InstancedMesh,
  state: PoolState,
  attributes: Record<'ages' | 'scales' | 'flashes', InstancedBufferAttribute>,
  dt: number
) {
  let moved = false;
  while (queue.length) {
    const ping = queue.shift()!;
    const slot = state.next;
    state.next = (slot + 1) % pool;
    state.lives[slot] = ping.life;
    state.ages[slot] = -ping.delay / ping.life;
    (attributes.scales.array as Float32Array)[slot] = ping.scale;
    (attributes.flashes.array as Float32Array)[slot] = ping.flash ? 1 : 0;
    mesh.setMatrixAt(slot, placed.makeTranslation(...ping.at));
    moved = true;
  }
  if (moved) {
    mesh.instanceMatrix.needsUpdate = true;
    attributes.scales.needsUpdate = true;
    attributes.flashes.needsUpdate = true;
  }
  let live = false;
  for (let i = 0; i < pool; i++) {
    if (state.ages[i] >= 1) continue;
    state.ages[i] = Math.min(1, state.ages[i] + dt / state.lives[i]);
    live = true;
  }
  if (live || moved) {
    (attributes.ages.array as Float32Array).set(state.ages);
    attributes.ages.needsUpdate = true;
  }
  return state.ages.some((age) => age < 1);
}
