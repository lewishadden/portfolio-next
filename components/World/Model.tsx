'use client';

import { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { easing } from 'maath';
import { Box3, Group, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';

import { applyGlowTheme, createFresnelMaterial } from './materials';
import { palettes } from './utils';

import type { ReactNode } from 'react';
import type { GroupProps } from './types';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Holographic core — shown while a model streams in, and used as
   the permanent stand-in if a model fails to load.
   ------------------------------------------------------------------ */
export function HoloCore({ theme, size = 1.4 }: { theme: WorldTheme; size?: number }) {
  const groupRef = useRef<Group>(null);
  const palette = palettes[theme];

  const shell = useMemo(
    () => createFresnelMaterial({ color: palette.cyan, power: 1.8, intensity: 2.2 }),
    [palette.cyan]
  );

  useEffect(() => applyGlowTheme(shell, theme), [shell, theme]);
  useEffect(() => () => shell.dispose(), [shell]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    group.rotation.y = clock.elapsedTime * 0.35;
    group.rotation.x = Math.sin(clock.elapsedTime * 0.4) * 0.3;
  });

  return (
    <group ref={groupRef}>
      <mesh material={shell}>
        <icosahedronGeometry args={[size, 3]} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[size * 1.02, 1]} />
        <meshBasicMaterial color={palette.violet} wireframe transparent opacity={0.45} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[size * 0.42, 0]} />
        <meshStandardMaterial
          color={palette.violet}
          emissive={palette.violet}
          emissiveIntensity={theme === 'light' ? 0.4 : 1.6}
          metalness={0.4}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------
   Error boundary — a missing or corrupt GLB degrades to the HoloCore
   ------------------------------------------------------------------ */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== 'production') console.warn('[World] model failed to load', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const box = new Box3();
const size = new Vector3();
const center = new Vector3();

/** Clones the scene, centres it on the origin and scales it to `height` world units */
function normaliseScene(scene: Object3D, height: number, envIntensity: number) {
  const clone = scene.clone(true);
  box.setFromObject(clone);
  box.getSize(size);
  box.getCenter(center);
  const scale = height / Math.max(size.y, 1e-3);
  clone.position.copy(center).multiplyScalar(-scale);
  clone.scale.setScalar(scale);
  clone.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as MeshStandardMaterial;
    if (material && 'envMapIntensity' in material) {
      material.envMapIntensity = envIntensity;
      material.needsUpdate = true;
    }
  });
  return clone;
}

function GltfModel({
  url,
  height,
  envIntensity,
}: {
  url: string;
  height: number;
  envIntensity: number;
}) {
  // No Draco (would fetch a decoder from a CDN); meshopt decoder ships with three-stdlib
  const { scene } = useGLTF(url, false, true);
  const model = useMemo(
    () => normaliseScene(scene, height, envIntensity),
    [scene, height, envIntensity]
  );
  const wrapperRef = useRef<Group>(null);

  // Pop in with a soft spring once loaded
  useFrame((_, delta) => {
    const wrapper = wrapperRef.current;
    if (wrapper) easing.damp3(wrapper.scale, 1, 0.35, Math.min(delta, 1 / 20));
  });

  return (
    <group ref={wrapperRef} scale={0.001}>
      <primitive object={model} />
    </group>
  );
}

/** Streams a GLB with a holographic placeholder and fallback */
export function Model({
  url,
  height,
  theme,
  envIntensity = 1.1,
  fallbackSize,
  ...props
}: GroupProps & {
  url: string;
  height: number;
  theme: WorldTheme;
  envIntensity?: number;
  fallbackSize?: number;
}) {
  const fallback = <HoloCore theme={theme} size={fallbackSize ?? height * 0.36} />;
  return (
    <group {...props}>
      <ModelBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <GltfModel url={url} height={height} envIntensity={envIntensity} />
        </Suspense>
      </ModelBoundary>
    </group>
  );
}
