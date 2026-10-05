'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Group, NormalBlending } from 'three';

import { createHaloMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { NavLights, SolarArray, Spin } from '../parts';
import {
  createReaction,
  easeInOut,
  stepReaction,
  trickProgress,
  useReactionHandlers,
} from '../reaction';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { StationHull } from '../StationHull';
import { stationModels, stationPositions } from '../stations';
import { palettes, seededRandom, setUniform } from '../utils';

import type { NavLight } from '../parts';
import type { WorldPalette, WorldTheme } from '../utils';

const helmetTip = { label: 'Helmet cam online', sub: 'Click to spin it' };

const habitatLights: NavLight[] = [
  { position: [-4.3, 0.1, 0], kind: 'white' },
  { position: [4.2, 0.1, 0], kind: 'white', phase: 0.8 },
  { position: [0.6, 5.65, 0], kind: 'red' },
  { position: [0.6, -5.65, 0], kind: 'green' },
  { position: [0, 1.65, 0.8], kind: 'cyan' },
  { position: [0, -1.6, 0.8], kind: 'violet' },
];

const buildMaterials = (p: WorldPalette) => ({
  ringA: createRingMaterial({
    colorA: p.cyan,
    colorB: p.violet,
    intensity: 2,
    dashes: 90,
    speed: 0.02,
    opacity: 0.8,
  }),
  ringB: createRingMaterial({ colorA: p.violet, colorB: p.pink, intensity: 2.2, speed: 0.05 }),
  ringC: createRingMaterial({
    colorA: p.cyan,
    colorB: p.cyan,
    intensity: 1.4,
    dashes: 24,
    speed: -0.04,
    opacity: 0.6,
  }),
  scan: createRingMaterial({ colorA: p.cyan, colorB: p.cyan, intensity: 3, speed: 0.2 }),
  scanDisc: createHaloMaterial({ color: p.cyan, intensity: 1.2, opacity: 0.4 }),
  halo: createHaloMaterial({ color: p.violet, intensity: 1.2, opacity: 0.55 }),
});

/** `/about` — the helmet, circled by holographic data rings and a scanning plane */
export function AboutStation({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const helmetRef = useRef<Group>(null);
  const ringsRef = useRef<Group>(null);
  const scanRef = useRef<Group>(null);
  const motesRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme);
  const palette = palettes[theme];
  const reaction = useRef(createReaction());
  const handlers = useReactionHandlers(reaction, helmetTip);

  const motes = useMemo(() => {
    const random = seededRandom(41);
    return Array.from({ length: 26 }, () => ({
      angle: random() * Math.PI * 2,
      radius: 1.8 + random() * 1.6,
      speed: 0.25 + random() * 0.5,
      offset: random() * 6,
      size: 0.025 + random() * 0.04,
    }));
  }, []);

  useFrame(({ camera, clock }, delta) => {
    if (!stationInRange(groupRef.current, camera, 'about')) return;
    const t = clock.elapsedTime;
    const r = reaction.current;
    stepReaction(r, t, Math.min(delta, 0.05));
    for (const material of [materials.ringA, materials.ringB, materials.ringC, materials.scan]) {
      setUniform(material, 'uTime', t);
    }

    const helmet = helmetRef.current;
    if (helmet) {
      // The visor follows the pointer, turns to face you on hover, spins on click
      const spin = trickProgress(r, 1.3);
      helmet.position.y = 0.35 + Math.sin(t * 0.8) * 0.14 + r.amount * 0.1;
      helmet.rotation.y =
        (0.15 + Math.sin(t * 0.3) * 0.3) * (1 - r.amount * 0.8) +
        r.yaw * 0.75 +
        (spin >= 0 ? easeInOut(spin) * Math.PI * 2 : 0);
      helmet.rotation.x = -r.pitch * 0.35;
      helmet.scale.setScalar(1 + r.amount * 0.06);
    }

    const rings = ringsRef.current;
    if (rings) {
      rings.children[0].rotation.z = t * 0.12;
      rings.children[1].rotation.z = -t * 0.08;
      rings.children[2].rotation.z = t * 0.2;
    }

    const scan = scanRef.current;
    if (scan) scan.position.y = Math.sin(t * 0.7) * 1.35;

    motesRef.current?.children.forEach((child, i) => {
      const m = motes[i];
      if (!m) return;
      const y = ((t * m.speed + m.offset) % 5) - 2.5;
      child.position.set(Math.cos(m.angle + t * 0.1) * m.radius, y, Math.sin(m.angle) * m.radius);
    });
  });

  return (
    <group ref={groupRef} position={stationPositions.about}>
      {/* The crew habitat, cupola turned towards the visitor */}
      <group position={[-3.4, 3.7, -15]} rotation={[0.2, 0.55, 0.08]}>
        <Spin>
          <StationHull station="about" height={3.2} theme={theme} />
          {/* Wings above and below the module, panels turned to face out */}
          <group position={[0.6, 1.2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <SolarArray rotation={[Math.PI / 2, 0, 0]} length={4.4} width={1.3} panels={3} />
          </group>
          <group position={[0.6, -1.2, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <SolarArray rotation={[-Math.PI / 2, 0, 0]} length={4.4} width={1.3} panels={3} />
          </group>
          <NavLights lights={habitatLights} />
        </Spin>
      </group>

      <mesh material={materials.halo} position={[0, 0, -3]} scale={9}>
        <planeGeometry />
      </mesh>

      <group ref={ringsRef}>
        <mesh material={materials.ringA} rotation={[Math.PI / 2.3, 0.2, 0]}>
          <torusGeometry args={[2.35, 0.012, 8, 240]} />
        </mesh>
        <mesh material={materials.ringB} rotation={[Math.PI / 2.6, -0.5, 0]}>
          <torusGeometry args={[2.75, 0.02, 12, 240]} />
        </mesh>
        <mesh material={materials.ringC} rotation={[1.9, 0.6, 0]}>
          <torusGeometry args={[3.15, 0.012, 8, 240]} />
        </mesh>
      </group>

      <group ref={scanRef}>
        <mesh material={materials.scan} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.85, 0.01, 8, 180]} />
        </mesh>
        <mesh material={materials.scanDisc} rotation={[-Math.PI / 2, 0, 0]} scale={3.6}>
          <planeGeometry />
        </mesh>
      </group>

      <group ref={motesRef}>
        {motes.map((m, i) => (
          <mesh key={i} scale={m.size}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial
              color={i % 3 ? palette.cyan : palette.violet}
              transparent
              opacity={0.85}
              blending={theme === 'light' ? NormalBlending : AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      <group ref={helmetRef} {...handlers}>
        <Model url={stationModels.about!} height={2.8} theme={theme} />
      </group>
    </group>
  );
}
