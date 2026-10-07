'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, MathUtils, NormalBlending, ShaderMaterial, Vector3 } from 'three';

import { cameraMotion } from './MotionProbe';
import { quadCorners, quadIndex, streakQuad, streakShape } from './Starfield';
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
  uniform vec3 uVelocity;
  uniform float uTrail;
  uniform vec2 uResolution;
  attribute vec3 aOffset;
  attribute float aSize;
  varying float vFade;
  ${streakQuad}
  void main() {
    vec3 drift = vec3(sin(uTime * 0.05 + aOffset.y) * 0.6, uTime * 0.25, cos(uTime * 0.04 + aOffset.x) * 0.6);
    vec3 p = mod(aOffset + drift - uCamera + uBox * 0.5, uBox) - uBox * 0.5;
    vFade = 1.0 - smoothstep(uBox * 0.28, uBox * 0.5, length(p));
    vec3 world = p + uCamera;
    vec4 mv = viewMatrix * vec4(world, 1.0);
    vec4 clip = projectionMatrix * mv;
    // A real motion trail: where the mote was, relative to the camera, a
    // moment ago (further along the way the camera is going), kept in front
    // of the camera
    vec4 back = viewMatrix * vec4(world + uVelocity * uTrail, 1.0);
    back.z = min(back.z, -0.2);
    vec4 backClip = projectionMatrix * back;
    vec2 halfSize = 0.5 * uResolution;
    vec2 delta = (backClip.xy / backClip.w - clip.xy / clip.w) * halfSize;
    float span = length(delta);
    vec2 dir = span > 0.001 ? -delta / span : vec2(1.0, 0.0);
    float radius = 0.5 * aSize * uPixelRatio * (1.0 + uWarp * 0.4) * (22.0 / -mv.z);
    gl_Position = streak(clip, dir, radius, min(span, uResolution.y * 0.2), halfSize);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  ${streakShape}
  void main() {
    float alpha = smoothstep(0.5, 0.05, streakDistance()) * vFade * uOpacity * streakFade();
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

/** Seconds of motion each mote's trail spans, at speed only */
const trailTime = 0.045;

/** The camera's velocity and how long a trail it leaves, and the drawing buffer's size in pixels */
function trackTrails(material: ShaderMaterial, width: number, height: number) {
  setUniform(material, 'uVelocity', cameraMotion.velocity);
  setUniform(material, 'uTrail', trailTime * MathUtils.smoothstep(cameraMotion.speed, 15, 70));
  const resolution = material.uniforms.uResolution.value as number[];
  resolution[0] = width;
  resolution[1] = height;
}

/**
 * Near-field motes wrapped around the camera — parallax when flying. At
 * speed each draws out into a trail along its motion past the camera
 * (speed lines); each is a small quad, round at rest
 */
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
          uVelocity: { value: new Vector3() },
          uTrail: { value: 0 },
          uResolution: { value: [1, 1] },
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

  useFrame(({ camera, clock, gl, size, viewport }) => {
    setUniform(material, 'uCamera', camera.position);
    setUniform(material, 'uTime', clock.elapsedTime);
    setUniform(material, 'uPixelRatio', viewport.dpr);
    setUniform(material, 'uWarp', Math.min(worldStore.velocity / 40, 1.4));
    trackTrails(material, size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
  });

  return (
    <mesh material={material} frustumCulled={false}>
      <instancedBufferGeometry instanceCount={count}>
        <bufferAttribute attach="attributes-position" args={[quadCorners, 3]} />
        <bufferAttribute attach="index" args={[quadIndex, 1]} />
        <instancedBufferAttribute attach="attributes-aOffset" args={[positions, 3]} />
        <instancedBufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </instancedBufferGeometry>
    </mesh>
  );
}
