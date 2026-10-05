'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';

import { createHaloMaterial } from '../materials';
import { Model } from '../Model';
import { NavLights } from '../parts';
import { Shards } from '../Shards';
import { StationHull } from '../StationHull';
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
  const wreckRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme);

  useFrame(({ camera, clock }) => {
    if (!stationInRange(groupRef.current, camera, 'lost')) return;
    const t = clock.elapsedTime;
    const drift = driftRef.current;
    if (!drift) return;
    drift.rotation.set(t * 0.21, t * 0.13, t * 0.17);
    drift.position.set(Math.sin(t * 0.2) * 0.6, Math.cos(t * 0.17) * 0.4, Math.sin(t * 0.1) * 0.8);
    const wreck = wreckRef.current;
    if (wreck) wreck.rotation.set(0.4 + t * 0.03, t * 0.05, 0.3 + t * 0.02);
  });

  return (
    <group ref={groupRef} position={stationPositions.lost}>
      <mesh material={materials.halo} position={[0, 0, -3]} scale={9}>
        <planeGeometry />
      </mesh>
      {/* What's left of the module it drifted from */}
      <group position={[-3.2, 1.2, -6]}>
        <group ref={wreckRef}>
          <StationHull station="lost" height={2.3} theme={theme} />
          <NavLights lights={[{ position: [0.3, 1.05, 0.4], kind: 'white', phase: 0.3 }]} />
        </group>
      </group>
      <Shards count={22} radius={4} seed={17} theme={theme} tumble />
      <group ref={driftRef}>
        <Model url={stationModels.lost!} height={3} theme={theme} />
      </group>
    </group>
  );
}
