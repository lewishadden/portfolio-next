'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  InstancedBufferAttribute,
  Matrix4,
  NormalBlending,
  ShaderMaterial,
} from 'three';

import { palettes } from './utils';
import { emitCue } from './worldStore';

import type { InstancedMesh, Vector3 } from 'three';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Click feedback in 3D: wherever a click lands on something in the
   world, a ring of light pings out from that point (two rings, a beat
   apart, facing the camera) and the 'ping' cue sounds. A small pool,
   one instanced draw, always mounted so it is compiled with the rest.
   ------------------------------------------------------------------ */

const pool = 8;
/** Seconds a ping lasts */
const lifetime = 0.9;

const queue: Vector3[] = [];

/** Pings out from a point in world space (an R3F event's `e.point`) */
export function spawnPing(point: Vector3) {
  queue.push(point.clone());
  emitCue('ping');
}

const vertexShader = /* glsl */ `
  attribute float aAge;
  varying vec2 vUv;
  varying float vAge;
  void main() {
    vUv = position.xy;
    vAge = aAge;
    // Faces the camera: the quad is laid out in view space round its centre
    vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float grow = 1.0 - pow(1.0 - clamp(aAge, 0.0, 1.0), 3.0);
    centre.xy += position.xy * mix(0.12, 1.5, grow);
    gl_Position = projectionMatrix * centre;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLight;
  varying vec2 vUv;
  varying float vAge;
  void main() {
    if (vAge >= 1.0) discard;
    float d = length(vUv);
    float ring = exp(-pow((d - 0.82) * 14.0, 2.0));
    // A second, fainter ring follows a beat behind, and a flash at the start
    float inner = exp(-pow((d - 0.82 * smoothstep(0.15, 1.0, vAge)) * 18.0, 2.0)) * 0.5;
    float flash = exp(-d * d * 30.0) * (1.0 - smoothstep(0.0, 0.25, vAge)) * 1.5;
    float fade = 1.0 - vAge;
    float alpha = (ring + inner + flash) * fade * fade;
    if (alpha < 0.004) discard;
    vec3 color = mix(uColor, vec3(1.0), flash * 0.5);
    gl_FragColor = vec4(color * mix(2.4, 1.0, uLight), min(alpha, 1.0));
  }
`;

const placed = new Matrix4();

export function Pings({ theme }: { theme: WorldTheme }) {
  const meshRef = useRef<InstancedMesh>(null);
  const state = useRef({ next: 0, ages: new Float32Array(pool).fill(1) });
  const palette = palettes[theme];

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

  const ages = useMemo(() => new InstancedBufferAttribute(new Float32Array(pool).fill(1), 1), []);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (mesh) step(mesh, state.current, ages, Math.min(delta, 0.05));
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, material, pool]}
      frustumCulled={false}
      renderOrder={20}
    >
      <planeGeometry args={[2, 2]}>
        <primitive object={ages} attach="attributes-aAge" />
      </planeGeometry>
    </instancedMesh>
  );
}

function paint(material: ShaderMaterial, color: string, theme: WorldTheme) {
  (material.uniforms.uColor.value as Color).set(color);
  material.uniforms.uLight.value = theme === 'light' ? 1 : 0;
  material.blending = theme === 'light' ? NormalBlending : AdditiveBlending;
  material.needsUpdate = true;
}

function step(
  mesh: InstancedMesh,
  state: { next: number; ages: Float32Array },
  ages: InstancedBufferAttribute,
  dt: number
) {
  let moved = false;
  while (queue.length) {
    const point = queue.shift()!;
    const slot = state.next;
    state.next = (slot + 1) % pool;
    state.ages[slot] = 0;
    mesh.setMatrixAt(slot, placed.makeTranslation(point.x, point.y, point.z));
    moved = true;
  }
  if (moved) mesh.instanceMatrix.needsUpdate = true;
  let live = false;
  for (let i = 0; i < pool; i++) {
    if (state.ages[i] >= 1) continue;
    state.ages[i] = Math.min(1, state.ages[i] + dt / lifetime);
    live = true;
  }
  if (live || moved) {
    (ages.array as Float32Array).set(state.ages);
    ages.needsUpdate = true;
  }
}
