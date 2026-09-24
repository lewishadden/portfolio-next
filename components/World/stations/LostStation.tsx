'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';

import { createHaloMaterial } from '../materials';
import { Model } from '../Model';
import { Shards } from '../Shards';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { stationModels, stationPositions } from '../stations';

import type { WorldPalette, WorldTheme } from '../utils';

const buildMaterials = (p: WorldPalette) => ({
  halo: createHaloMaterial({ color: p.pink, intensity: 1, opacity: 0.35 }),
});

/** 404 — the astronaut has drifted off the map */
export function LostStation({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const driftRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme);

  useFrame(({ camera, clock }) => {
    if (!stationInRange(groupRef.current, camera, 'lost')) return;
    const t = clock.elapsedTime;
    const drift = driftRef.current;
    if (!drift) return;
    drift.rotation.set(t * 0.21, t * 0.13, t * 0.17);
    drift.position.set(Math.sin(t * 0.2) * 0.6, Math.cos(t * 0.17) * 0.4, Math.sin(t * 0.1) * 0.8);
  });

  return (
    <group ref={groupRef} position={stationPositions.lost}>
      <mesh material={materials.halo} position={[0, 0, -3]} scale={9}>
        <planeGeometry />
      </mesh>
      <Shards count={22} radius={4} seed={17} theme={theme} tumble />
      <group ref={driftRef}>
        <Model url={stationModels.lost!} height={3} theme={theme} />
      </group>
    </group>
  );
}
