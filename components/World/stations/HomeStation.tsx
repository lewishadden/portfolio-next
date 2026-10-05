'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';

import { createHaloMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { Antenna, NavLights, SolarArray } from '../parts';
import {
  createReaction,
  easeInOut,
  stepReaction,
  trickProgress,
  useReactionHandlers,
} from '../reaction';
import { Shards } from '../Shards';
import { StationHull } from '../StationHull';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { stationModels, stationPositions } from '../stations';
import { setUniform } from '../utils';

import type { NavLight } from '../parts';
import type { WorldPalette, WorldTheme } from '../utils';

const astronautTip = { label: 'Hello from Peterborough 👋', sub: 'Click for a barrel roll' };

const hubLights: NavLight[] = [
  // Wing tips (port red, starboard green), mast and keel strobes, hull accents
  { position: [-11.3, 0.5, 0], kind: 'red' },
  { position: [11.3, 0.5, 0], kind: 'green' },
  { position: [0.5, 6.35, 0.4], kind: 'white' },
  { position: [0, -3.7, 0], kind: 'white', phase: 0.8 },
  { position: [2.1, 1.8, 2.3], kind: 'cyan' },
  { position: [-2.2, -1.2, 2.4], kind: 'violet' },
];

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
  const hubRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme);
  const reaction = useRef(createReaction());
  const handlers = useReactionHandlers(reaction, astronautTip);

  useFrame(({ camera, clock }, delta) => {
    if (!stationInRange(groupRef.current, camera, 'home')) return;
    const t = clock.elapsedTime;
    const r = reaction.current;
    stepReaction(r, t, Math.min(delta, 0.05));
    setUniform(materials.portal, 'uTime', t);
    setUniform(materials.orbit, 'uTime', t);
    setUniform(materials.outer, 'uTime', t);

    const float = floatRef.current;
    if (float) {
      // Watches the pointer, leans in when hovered, barrel-rolls when clicked
      const roll = trickProgress(r, 1.2);
      const hop = roll >= 0 ? Math.sin(roll * Math.PI) * 0.55 : 0;
      float.position.y = Math.sin(t * 0.9) * 0.18 + r.amount * 0.12 + hop;
      float.rotation.y = -0.5 + Math.sin(t * 0.25) * 0.12 + r.yaw * 0.6;
      float.rotation.x = -r.pitch * 0.3 - r.amount * 0.12;
      float.rotation.z =
        Math.sin(t * 0.6) * 0.06 +
        Math.sin(t * 7) * 0.035 * r.amount +
        (roll >= 0 ? easeInOut(roll) * Math.PI * 2 : 0);
      float.scale.setScalar(1 + r.amount * 0.05);
    }
    if (portalRef.current) portalRef.current.rotation.z = t * 0.05;
    if (orbitRef.current) orbitRef.current.rotation.z = -t * 0.08;
    if (outerRef.current) outerRef.current.rotation.z = t * 0.03;
    if (hubRef.current) hubRef.current.rotation.y = 0.7 + t * 0.085;
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

      {/* The gateway hub the astronaut has stepped out of */}
      <group position={[4.2, 3.1, -16]} rotation={[0.16, 0, -0.1]}>
        <group ref={hubRef}>
          <StationHull station="home" height={7.2} theme={theme} />
          {/* Wings tilted towards the sun (and the visitor) */}
          <SolarArray
            position={[3.3, 0.5, 0]}
            rotation={[1.15, 0, 0]}
            length={8}
            width={1.8}
            panels={5}
          />
          <group position={[-3.3, 0.5, 0]} rotation={[0, Math.PI, 0]}>
            <SolarArray rotation={[-1.15, 0, 0]} length={8} width={1.8} panels={5} />
          </group>
          <Antenna position={[0.5, 3.5, 0.4]} height={2.8} dish={0.75} />
          <NavLights lights={hubLights} />
        </group>
      </group>

      <Shards count={18} radius={3.4} seed={3} theme={theme} />

      <group ref={floatRef} {...handlers}>
        <Model url={stationModels.home!} height={3.5} theme={theme} />
      </group>
    </group>
  );
}
