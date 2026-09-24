'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { Group, Mesh, MeshStandardMaterial } from 'three';

import { createBeamMaterial, createHaloMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { experienceDepth, stationModels, stationPositions } from '../stations';
import { palettes, setUniform } from '../utils';

import type { WorldPalette, WorldTheme } from '../utils';

const buildMaterials = (p: WorldPalette) => ({
  core: createBeamMaterial({ color: p.cyan, intensity: 3, speed: 0.6 }),
  glow: createBeamMaterial({ color: p.violet, intensity: 1.4, opacity: 0.35, speed: 0.25 }),
  nodeRing: createRingMaterial({
    colorA: p.violet,
    colorB: p.cyan,
    intensity: 2.2,
    dashes: 36,
    speed: 0.05,
  }),
  halo: createHaloMaterial({ color: p.cyan, intensity: 1.2, opacity: 0.5 }),
  topHalo: createHaloMaterial({ color: p.violet, intensity: 1.2, opacity: 0.5 }),
});

function lightNode(node: Group, activation: number, dt: number) {
  const [core, ring, halo] = node.children as Mesh[];
  easing.damp(node.scale, 'x', 0.8 + activation * 0.5, 0.25, dt);
  node.scale.y = node.scale.z = node.scale.x;
  const material = core.material as MeshStandardMaterial;
  material.emissiveIntensity = 0.4 + activation * 3.2;
  ring.rotation.z += dt * (0.3 + activation * 1.4);
  halo.visible = activation > 0.05;
  halo.scale.setScalar(2.4 + activation * 2.4);
}

/** `/experience` — a satellite escorts the camera down a beam; one glowing node per role */
export function ExperienceStation({ theme, count }: { theme: WorldTheme; count: number }) {
  const groupRef = useRef<Group>(null);
  const satelliteRef = useRef<Group>(null);
  const nodesRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme);
  const palette = palettes[theme];
  const beamLength = experienceDepth + 10;

  const nodeYs = useMemo(
    () => Array.from({ length: count }, (_, i) => -((i + 0.6) / count) * experienceDepth),
    [count]
  );

  useFrame(({ camera, clock }, delta) => {
    const group = groupRef.current;
    if (!stationInRange(group, camera, 'experience') || !group) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 1 / 20);
    setUniform(materials.core, 'uTime', t);
    setUniform(materials.glow, 'uTime', t);
    setUniform(materials.nodeRing, 'uTime', t);

    const localCameraY = camera.position.y - group.position.y;

    const satellite = satelliteRef.current;
    if (satellite) {
      const angle = t * 0.35;
      const targetY = Math.min(1.6, localCameraY + 1.2);
      easing.damp(satellite.position, 'y', targetY, 0.4, dt);
      satellite.position.x = Math.cos(angle) * 2.9;
      satellite.position.z = Math.sin(angle) * 2.9;
      satellite.rotation.y = -angle + Math.PI / 2;
      satellite.rotation.z = Math.sin(t * 0.5) * 0.15;
    }

    nodesRef.current?.children.forEach((node, i) => {
      const distance = Math.abs(localCameraY - nodeYs[i]);
      const activation = Math.max(0, 1 - distance / 5);
      lightNode(node as Group, activation, dt);
    });
  });

  return (
    <group ref={groupRef} position={stationPositions.experience}>
      <mesh material={materials.topHalo} position={[0, 1, -2.5]} scale={9}>
        <planeGeometry />
      </mesh>

      <group position={[0, 4 - beamLength / 2, 0]}>
        <mesh material={materials.core}>
          <cylinderGeometry args={[0.045, 0.045, beamLength, 12, 1, true]} />
        </mesh>
        <mesh material={materials.glow}>
          <cylinderGeometry args={[0.38, 0.38, beamLength, 24, 1, true]} />
        </mesh>
      </group>

      <group ref={nodesRef}>
        {nodeYs.map((y) => (
          <group key={y} position={[0, y, 0]}>
            <mesh>
              <sphereGeometry args={[0.24, 32, 16]} />
              <meshStandardMaterial
                color={palette.cyan}
                emissive={palette.cyan}
                emissiveIntensity={0.4}
                roughness={0.2}
                metalness={0.1}
                toneMapped={false}
              />
            </mesh>
            <mesh material={materials.nodeRing} rotation={[Math.PI / 2.4, 0, 0]}>
              <torusGeometry args={[0.72, 0.016, 8, 120]} />
            </mesh>
            <mesh material={materials.halo} visible={false}>
              <planeGeometry />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={satelliteRef} position={[2.9, 1.6, 0]}>
        <Model url={stationModels.experience!} height={2.1} theme={theme} />
      </group>
    </group>
  );
}
