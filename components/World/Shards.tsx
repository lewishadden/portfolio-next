'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D, Vector3 } from 'three';

import { palettes, seededRandom } from './utils';

import type { WorldTheme } from './utils';

const dummy = new Object3D();
const axisX = new Vector3(1, 0, 0);
const axisZ = new Vector3(0, 0, 1);

interface Orbit {
  radius: number;
  speed: number;
  phase: number;
  tiltX: number;
  tiltZ: number;
  scale: number;
  spin: number;
  bob: number;
}

function paintShards(mesh: InstancedMesh | null, theme: WorldTheme, count: number) {
  if (!mesh) return;
  const palette = palettes[theme];
  const colors = [new Color(palette.violet), new Color(palette.cyan), new Color(palette.pink)];
  for (let i = 0; i < count; i++) mesh.setColorAt(i, colors[i % 3]);
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/** Glossy crystal fragments on tilted elliptical orbits */
export function Shards({
  count = 16,
  radius = 3,
  seed = 1,
  theme,
  tumble = false,
}: {
  count?: number;
  radius?: number;
  seed?: number;
  theme: WorldTheme;
  tumble?: boolean;
}) {
  const meshRef = useRef<InstancedMesh>(null);

  const orbits = useMemo<Orbit[]>(() => {
    const random = seededRandom(seed);
    return Array.from({ length: count }, () => ({
      radius: radius * (0.75 + random() * 0.7),
      speed: (0.08 + random() * 0.22) * (random() > 0.5 ? 1 : -1),
      phase: random() * Math.PI * 2,
      tiltX: (random() - 0.5) * 1.1,
      tiltZ: (random() - 0.5) * 0.9,
      scale: 0.06 + Math.pow(random(), 2) * 0.16,
      spin: 0.4 + random() * 1.4,
      bob: random() * Math.PI * 2,
    }));
  }, [count, radius, seed]);

  useEffect(() => paintShards(meshRef.current, theme, count), [theme, count]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || !mesh.visible) return;
    const t = clock.elapsedTime;
    orbits.forEach((o, i) => {
      const a = o.phase + t * o.speed;
      const x = Math.cos(a) * o.radius;
      const z = Math.sin(a) * o.radius * 0.6;
      const y = Math.sin(t * 0.6 + o.bob) * 0.25;
      dummy.position.set(x, y, z);
      dummy.position.applyAxisAngle(axisX, o.tiltX);
      dummy.position.applyAxisAngle(axisZ, o.tiltZ);
      dummy.rotation.set(t * o.spin, t * o.spin * 0.7, tumble ? t * 0.3 : 0);
      dummy.scale.setScalar(o.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial metalness={0.35} roughness={0.16} flatShading />
    </instancedMesh>
  );
}
