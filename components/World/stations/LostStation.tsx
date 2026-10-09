'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { Group } from 'three';

import { createHaloMaterial } from '../materials';
import { Model } from '../Model';
import { NavLights } from '../parts';
import { StationScope } from '../power';
import {
  createReaction,
  easeInOut,
  stepReaction,
  trickProgress,
  useReactionHandlers,
  useShowcase,
} from '../reaction';
import { Shards } from '../Shards';
import { StationHull } from '../StationHull';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { stationModels, stationPositions } from '../stations';

import type { WorldPalette, WorldTheme } from '../utils';

const buildMaterials = (p: WorldPalette) => ({
  halo: createHaloMaterial({ color: p.pink, intensity: 1, opacity: 0.35 }),
});

const lostTip = { label: 'Lost in space', sub: 'Click to give them a nudge' };
/** Seconds the astronaut flails after a nudge */
const flailTime = 1.6;

/** 404 — the astronaut has drifted off the map */
export function LostStation({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const driftRef = useRef<Group>(null);
  const wreckRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme, 'lost');
  const reaction = useRef(createReaction());
  const handlers = useReactionHandlers(reaction, lostTip, flailTime);
  useShowcase('lost', driftRef, reaction, flailTime);

  useFrame(({ camera, clock }, delta) => {
    if (!stationInRange(groupRef.current, camera, 'lost')) return;
    const t = clock.elapsedTime;
    const r = reaction.current;
    stepReaction(r, t, Math.min(delta, 0.05));
    const drift = driftRef.current;
    if (!drift) return;
    // A nudge sends it tumbling faster, limbs flailing, until it slows again
    const flail = trickProgress(r, flailTime);
    const tumble = flail >= 0 ? easeInOut(flail) * Math.PI * 3 : 0;
    const shake = flail >= 0 ? Math.sin(flail * Math.PI) * Math.sin(t * 28) * 0.12 : 0;
    drift.rotation.set(t * 0.21 + tumble, t * 0.13 + shake, t * 0.17 + tumble * 0.4);
    drift.scale.setScalar(1 + r.amount * 0.05);
    drift.position.set(Math.sin(t * 0.2) * 0.6, Math.cos(t * 0.17) * 0.4, Math.sin(t * 0.1) * 0.8);
    const wreck = wreckRef.current;
    if (wreck) wreck.rotation.set(0.4 + t * 0.03, t * 0.05, 0.3 + t * 0.02);
  });

  return (
    <StationScope station="lost">
      <group ref={groupRef} position={stationPositions.lost}>
        <Billboard position={[0, 0, -3]}>
          <mesh material={materials.halo} scale={9}>
            <planeGeometry />
          </mesh>
        </Billboard>
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
          {/* Never drawn: the astronaut's target for the pointer (a capsule, not its triangles) */}
          <mesh visible={false} {...handlers}>
            <capsuleGeometry args={[0.95, 1.2, 4, 12]} />
          </mesh>
        </group>
      </group>
    </StationScope>
  );
}
