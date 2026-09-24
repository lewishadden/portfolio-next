'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, NormalBlending, Points, ShaderMaterial } from 'three';

import { palettes, seededRandom, setUniform } from './utils';
import { worldStore } from './worldStore';

import type { WorldTheme } from './utils';

const center = [0, 0, -110];

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uWarp;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vTwinkle = 0.55 + 0.45 * sin(uTime * (0.4 + aPhase * 1.6) + aPhase * 6.2831);
    vColor = aColor;
    gl_PointSize = aSize * uPixelRatio * (1.0 + uWarp) * (340.0 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    float alpha = (pow(core, 3.0) + core * 0.25) * vTwinkle * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor * 1.4, alpha);
  }
`;

function applyStarTheme(material: ShaderMaterial, colors: Float32Array, theme: WorldTheme) {
  const palette = palettes[theme];
  material.blending = palette.additive ? AdditiveBlending : NormalBlending;
  material.needsUpdate = true;
  setUniform(material, 'uOpacity', palette.starOpacity);
  const tints = palette.stars.map((c) => new Color(c));
  const random = seededRandom(11);
  for (let i = 0; i < colors.length / 3; i++) {
    const r = random();
    const tint = r < 0.7 ? tints[0] : r < 0.86 ? tints[1] : tints[2];
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
}

/** Twinkling star shell enclosing every station; points swell as the camera warps */
export function Starfield({ count, theme }: { count: number; theme: WorldTheme }) {
  const pointsRef = useRef<Points>(null);

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
    const attribute = pointsRef.current?.geometry.getAttribute('aColor');
    if (attribute) attribute.needsUpdate = true;
  }, [material, colors, theme]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock, viewport }) => {
    setUniform(material, 'uTime', clock.elapsedTime);
    setUniform(material, 'uPixelRatio', viewport.dpr);
    setUniform(material, 'uWarp', Math.min(worldStore.velocity / 40, 1.4));
  });

  return (
    <points ref={pointsRef} material={material} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </bufferGeometry>
    </points>
  );
}
