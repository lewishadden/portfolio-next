'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, ShaderMaterial, Vector3 } from 'three';

import { motionLevel } from '@/utils/motion';

import { applyGlowTheme, asGlow } from './materials';
import { sectorCentre, sectorRadius } from './routes';
import { worldMode } from './worldMode';
import { worldStore } from './worldStore';

import type { Mesh } from 'three';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   The edge of the world, shown only as free roam's ship nears it: one
   square of hexagonal shimmer, a little beyond the edge straight out
   from the middle of the sector towards the ship, facing back in, so
   the ship meets a wall of light where it is turned round. It fades in
   with worldStore.edge (0 well inside the sector, 1 at its edge) and
   out to nothing round its own rim. One quad, never a sphere round the
   world: only the patch the ship is heading for is drawn, and only
   while it is near.
   ------------------------------------------------------------------ */

/** World units across the patch, and how far beyond the edge it hangs (the ship never reaches it) */
const size = 120;
const beyond = 12;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uEdge;
  uniform float uTime;
  uniform float uLight;
  varying vec2 vUv;
  // Distance to the nearest hexagon's edge (0 on it), for a cell of radius ~1
  float hexEdge(vec2 p) {
    const vec2 k = vec2(1.0, 1.7320508);
    vec2 a = mod(p, k) - k * 0.5;
    vec2 b = mod(p + k * 0.5, k) - k * 0.5;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    vec2 q = abs(g);
    return 0.5 - max(dot(q, normalize(k)), q.x);
  }
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float rim = 1.0 - smoothstep(0.3, 1.0, length(p));
    if (rim <= 0.0) discard;
    // Hairlines, about a pixel and a half wide however near the wall is
    float d = hexEdge(p * 40.0);
    float lines = 1.0 - smoothstep(0.0, fwidth(d) * 1.5 + 0.002, d);
    // A slow band of light sweeps across the cells
    float sweep = 0.35 + 0.65 * smoothstep(0.6, 1.0, sin(dot(p, vec2(4.0, 2.5)) * 2.0 - uTime * 1.4));
    float alpha = lines * sweep * rim * uEdge * 0.5;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor * mix(0.9, 1.0, uLight), min(alpha, 1.0));
  }
`;

function createMaterial() {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color() },
        uEdge: { value: 0 },
        uTime: { value: 0 },
        uLight: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    })
  );
}

const tones: Record<WorldTheme, string> = { dark: '#22d3ee', light: '#6d28d9' };

const centre = new Vector3(...sectorCentre);
const out = new Vector3();

function step(mesh: Mesh, material: ShaderMaterial, camera: Vector3, t: number) {
  const edge = worldMode.get().mode === 'explore' ? worldStore.edge : 0;
  mesh.visible = edge > 0.01;
  if (!mesh.visible) return;
  // Straight out from the middle of the sector towards the ship, facing back in
  out.subVectors(camera, centre);
  if (out.lengthSq() < 1e-6) out.set(0, 0, 1);
  out.normalize();
  mesh.position.copy(centre).addScaledVector(out, sectorRadius + beyond);
  mesh.lookAt(centre);
  material.uniforms.uEdge.value = edge;
  // Still: the cells hold still
  if (motionLevel() !== 'still') material.uniforms.uTime.value = t;
}

/** Free roam: the edge of the world, shimmering in as the ship nears it (see above) */
export function EdgeShimmer({ theme }: { theme: WorldTheme }) {
  const meshRef = useRef<Mesh>(null);
  const material = useMemo(() => createMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    (material.uniforms.uColor.value as Color).set(tones[theme]);
    applyGlowTheme(material, theme);
  }, [material, theme]);

  useFrame(({ camera, clock }) => {
    const mesh = meshRef.current;
    if (mesh) step(mesh, material, camera.position, clock.elapsedTime);
  });

  return (
    <mesh ref={meshRef} material={material} frustumCulled={false} renderOrder={8}>
      <planeGeometry args={[size, size]} />
    </mesh>
  );
}
