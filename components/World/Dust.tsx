'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, NormalBlending, ShaderMaterial } from 'three';

import { palettes, seededRandom, setUniform } from './utils';
import { worldStore } from './worldStore';

import type { WorldTheme } from './utils';

const box = 48;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uBox;
  uniform float uPixelRatio;
  uniform float uWarp;
  uniform vec3 uCamera;
  attribute float aSize;
  varying float vFade;
  void main() {
    vec3 drift = vec3(sin(uTime * 0.05 + position.y) * 0.6, uTime * 0.25, cos(uTime * 0.04 + position.x) * 0.6);
    vec3 p = mod(position + drift - uCamera + uBox * 0.5, uBox) - uBox * 0.5;
    vFade = 1.0 - smoothstep(uBox * 0.28, uBox * 0.5, length(p));
    vec4 mv = viewMatrix * vec4(p + uCamera, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (1.0 + uWarp * 1.5) * (22.0 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.05, d) * vFade * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function applyDustTheme(material: ShaderMaterial, theme: WorldTheme) {
  const palette = palettes[theme];
  material.blending = palette.additive ? AdditiveBlending : NormalBlending;
  material.needsUpdate = true;
  setUniform(material, 'uColor', palette.additive ? '#c7d2fe' : '#4338ca');
  setUniform(material, 'uOpacity', palette.additive ? 0.55 : 0.35);
}

/** Near-field particles wrapped around the camera — gives parallax when flying */
export function Dust({ count, theme }: { count: number; theme: WorldTheme }) {
  const { positions, sizes } = useMemo(() => {
    const random = seededRandom(23);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() - 0.5) * box;
      positions[i * 3 + 1] = (random() - 0.5) * box;
      positions[i * 3 + 2] = (random() - 0.5) * box;
      sizes[i] = 0.6 + random() * 2.2;
    }
    return { positions, sizes };
  }, [count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBox: { value: box },
          uPixelRatio: { value: 1 },
          uWarp: { value: 0 },
          uCamera: { value: null },
          uColor: { value: new Color() },
          uOpacity: { value: 0.6 },
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

  useEffect(() => applyDustTheme(material, theme), [material, theme]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, clock, viewport }) => {
    setUniform(material, 'uCamera', camera.position);
    setUniform(material, 'uTime', clock.elapsedTime);
    setUniform(material, 'uPixelRatio', viewport.dpr);
    setUniform(material, 'uWarp', Math.min(worldStore.velocity / 40, 1.4));
  });

  return (
    <points material={material} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
    </points>
  );
}
