'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';

import { createHaloMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { Shards } from '../Shards';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { stationModels, stationPositions } from '../stations';
import { setUniform } from '../utils';
import { worldStore } from '../worldStore';

import type { WorldPalette, WorldTheme } from '../utils';

const buildMaterials = (p: WorldPalette) => ({
  portal: createRingMaterial({ colorA: p.violet, colorB: p.cyan, intensity: 2.6, speed: 0.06 }),
  orbit: createRingMaterial({
    colorA: p.cyan,
    colorB: p.pink,
    intensity: 1.8,
    dashes: 64,
    speed: 0.03,
    opacity: 0.75,
  }),
  outer: createRingMaterial({
    colorA: p.violet,
    colorB: p.violet,
    intensity: 1.2,
    dashes: 140,
    speed: -0.015,
    opacity: 0.45,
  }),
  halo: createHaloMaterial({ color: p.violet, intensity: 1.3, opacity: 0.6 }),
  haloCyan: createHaloMaterial({ color: p.cyan, intensity: 1, opacity: 0.35 }),
});

/** `/` — astronaut coder floating in front of an energy portal */
export function HomeStation({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const floatRef = useRef<Group>(null);
  const portalRef = useRef<Mesh>(null);
  const orbitRef = useRef<Mesh>(null);
  const outerRef = useRef<Mesh>(null);
  const materials = useThemedMaterials(buildMaterials, theme);

  useFrame(({ camera, clock }) => {
    if (!stationInRange(groupRef.current, camera, 'home')) return;
    const t = clock.elapsedTime;
    setUniform(materials.portal, 'uTime', t);
    setUniform(materials.orbit, 'uTime', t);
    setUniform(materials.outer, 'uTime', t);

    const float = floatRef.current;
    if (float) {
      float.position.y = Math.sin(t * 0.9) * 0.18;
      float.rotation.y = -0.5 + Math.sin(t * 0.25) * 0.15 + worldStore.pointerX * 0.35;
      float.rotation.x = -worldStore.pointerY * 0.12;
      float.rotation.z = Math.sin(t * 0.6) * 0.06;
    }
    if (portalRef.current) portalRef.current.rotation.z = t * 0.05;
    if (orbitRef.current) orbitRef.current.rotation.z = -t * 0.08;
    if (outerRef.current) outerRef.current.rotation.z = t * 0.03;
  });

  return (
    <group ref={groupRef} position={stationPositions.home}>
      <mesh material={materials.halo} position={[0, 0, -3]} scale={10}>
        <planeGeometry />
      </mesh>
      <mesh material={materials.haloCyan} position={[1.4, -1.2, -3.4]} scale={7}>
        <planeGeometry />
      </mesh>

      <group rotation={[0.18, -0.22, 0]} position={[0, 0, -1.6]}>
        <mesh ref={portalRef} material={materials.portal}>
          <torusGeometry args={[2.75, 0.03, 16, 220]} />
        </mesh>
        <mesh ref={orbitRef} material={materials.orbit} rotation={[0, 0, 0.4]}>
          <torusGeometry args={[3.25, 0.014, 8, 260]} />
        </mesh>
        <mesh ref={outerRef} material={materials.outer}>
          <torusGeometry args={[3.9, 0.01, 8, 300]} />
        </mesh>
      </group>

      <Shards count={18} radius={3.4} seed={3} theme={theme} />

      <group ref={floatRef}>
        <Model url={stationModels.home!} height={3.5} theme={theme} />
      </group>
    </group>
  );
}
