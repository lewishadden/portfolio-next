'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Group, NormalBlending } from 'three';

import { createHaloMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { stationModels, stationPositions } from '../stations';
import { palettes, seededRandom, setUniform } from '../utils';
import { worldStore } from '../worldStore';

import type { WorldPalette, WorldTheme } from '../utils';

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

  useFrame(({ camera, clock }) => {
    if (!stationInRange(groupRef.current, camera, 'about')) return;
    const t = clock.elapsedTime;
    for (const material of [materials.ringA, materials.ringB, materials.ringC, materials.scan]) {
      setUniform(material, 'uTime', t);
    }

    const helmet = helmetRef.current;
    if (helmet) {
      helmet.position.y = 0.35 + Math.sin(t * 0.8) * 0.14;
      helmet.rotation.y = 0.15 + Math.sin(t * 0.3) * 0.3 + worldStore.pointerX * 0.4;
      helmet.rotation.x = -worldStore.pointerY * 0.15;
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

      <group ref={helmetRef}>
        <Model url={stationModels.about!} height={2.8} theme={theme} />
      </group>
    </group>
  );
}
