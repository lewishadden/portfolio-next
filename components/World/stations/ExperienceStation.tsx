'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { easing } from 'maath';
import { Group, MathUtils, Mesh, MeshStandardMaterial } from 'three';

import { createBeamMaterial, createHaloMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { Antenna, NavLights, SolarArray, Spin } from '../parts';
import { spawnPing } from '../Pings';
import { StationScope, stationPower } from '../power';
import {
  createReaction,
  easeInOut,
  stepReaction,
  trickProgress,
  useReactionHandlers,
} from '../reaction';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { StationHull } from '../StationHull';
import {
  experienceDepth,
  framedHeight,
  isWideViewport,
  stationModels,
  stationPositions,
} from '../stations';
import { palettes, setUniform } from '../utils';
import { focusOnPage, setWorldHover, worldStore, worldTip } from '../worldStore';

import type { ThreeEvent } from '@react-three/fiber';
import type { NavLight } from '../parts';
import type { WorldTip } from '../worldStore';
import type { WorldContent } from '../types';
import type { WorldPalette, WorldTheme } from '../utils';

const satelliteTip = { label: 'Survey satellite', sub: 'Click to ping the beam' };
/** Seconds the satellite's roll takes, and its ping's run down the beam */
const rollTime = 1.4;
const pingTime = 1.8;

const tetherLights: NavLight[] = [
  // Wing tips, mast strobe and the beam's anchor under the hull
  { position: [-5.4, 0.3, 0], kind: 'red' },
  { position: [5.4, 0.3, 0], kind: 'green' },
  { position: [0.2, 3.1, 0], kind: 'white' },
  { position: [0, -1.85, 0], kind: 'cyan' },
  { position: [0.9, 0.6, 0.9], kind: 'violet', phase: 0.6 },
];

/** Which pod the pointer is over (-1 for none): it lights as if it were being read */
type Hovered = { current: number };

function hoverNode(
  e: ThreeEvent<PointerEvent>,
  tip: WorldTip,
  on: boolean,
  hovered: Hovered,
  index: number
) {
  if (on) {
    e.stopPropagation();
    setWorldHover(true);
    worldTip.set(tip);
    hovered.current = index;
  } else {
    setWorldHover(false);
    if (worldTip.get() === tip) worldTip.set(null);
    if (hovered.current === index) hovered.current = -1;
  }
}

const buildMaterials = (p: WorldPalette) => ({
  core: createBeamMaterial({ color: p.cyan, intensity: 3, speed: 0.6 }),
  glow: createBeamMaterial({ color: p.violet, intensity: 1.3, opacity: 0.24, speed: 0.25 }),
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

/** Lights a pod by how strongly it is read, pointed at or pinged; its glow follows the station's power */
function lightNode(node: Group, activation: number, charge: number, dt: number) {
  const [core, ring, halo] = node.children as Mesh[];
  easing.damp(node.scale, 'x', 0.8 + activation * 0.5, 0.25, dt);
  node.scale.y = node.scale.z = node.scale.x;
  const material = core.material as MeshStandardMaterial;
  material.emissiveIntensity = (0.4 + activation * 3.2) * charge;
  ring.rotation.z += dt * (0.3 + activation * 1.4);
  halo.visible = activation > 0.05;
  halo.scale.setScalar(2.4 + activation * 2.4);
}

/**
 * `/experience`: a satellite escorts the camera down a pulsing beam that
 * hangs from the station's hull; one glowing node per role. On the page the
 * camera rides down to the role being read and its node lights (a mission
 * log); elsewhere nodes light as the camera passes them. Hover for the role,
 * click to jump to it on the page.
 */
export function ExperienceStation({
  theme,
  roles,
}: {
  theme: WorldTheme;
  roles: WorldContent['roles'];
}) {
  const count = roles.length;
  const tips = useMemo(
    () =>
      roles.map((role) => ({
        label: `${role.title} · ${role.company}`,
        sub: 'Click to read more',
      })),
    [roles]
  );
  const groupRef = useRef<Group>(null);
  const satelliteRef = useRef<Group>(null);
  const nodesRef = useRef<Group>(null);
  const pingRef = useRef<Group>(null);
  const hovered = useRef(-1);
  const reaction = useRef(createReaction());
  const handlers = useReactionHandlers(reaction, satelliteTip, rollTime);
  const materials = useThemedMaterials(buildMaterials, theme, 'experience');
  const palette = palettes[theme];
  const beamLength = experienceDepth + 10;

  const nodeYs = useMemo(
    () => Array.from({ length: count }, (_, i) => -((i + 0.6) / count) * experienceDepth),
    [count]
  );

  useFrame(({ camera, clock, size }, delta) => {
    const group = groupRef.current;
    if (!stationInRange(group, camera, 'experience') || !group) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 1 / 20);
    setUniform(materials.core, 'uTime', t);
    setUniform(materials.glow, 'uTime', t);
    setUniform(materials.nodeRing, 'uTime', t);

    const localCameraY = camera.position.y - group.position.y;
    const r = reaction.current;
    stepReaction(r, t, dt);

    const satellite = satelliteRef.current;
    if (satellite) {
      const angle = t * 0.35;
      // Wide: up beside the copy. Narrow: centred in the stage slot above it
      const framedY = framedHeight('experience', localCameraY, size.width, size.height);
      const targetY = isWideViewport(size.width, size.height)
        ? Math.min(1.6, framedY + 1.8)
        : framedY;
      easing.damp(satellite.position, 'y', targetY, 0.4, dt);
      satellite.position.x = Math.cos(angle) * 2.3;
      satellite.position.z = Math.sin(angle) * 2.3;
      // Keep the sensor eye turned towards the camera as it circles the beam;
      // hovered it turns a little more to you, clicked it rolls
      const roll = trickProgress(r, rollTime);
      satellite.rotation.y = Math.sin(t * 0.3) * 0.4 + r.yaw * 0.3 * r.amount;
      satellite.rotation.z =
        Math.sin(t * 0.5) * 0.15 + (roll >= 0 ? easeInOut(roll) * Math.PI * 2 : 0);
      satellite.scale.setScalar(1 + r.amount * 0.08);
    }

    // The satellite's ping runs down the beam past every pod
    const ping = pingRef.current;
    if (ping) {
      const run = trickProgress(r, pingTime);
      ping.visible = run >= 0;
      if (run >= 0) {
        ping.position.y = MathUtils.lerp(
          satellite?.position.y ?? 1.6,
          -experienceDepth - 2,
          run * run
        );
        ping.scale.setScalar(0.9 + Math.sin(run * Math.PI) * 0.6);
      }
    }

    // The pod of the role being read on the page lights; elsewhere (the
    // tour, free roam) whichever pods the camera passes
    const reading = worldStore.roleFocus;
    const pingY = ping?.visible ? ping.position.y : Infinity;
    const charge = stationPower.experience.charge.value;
    nodesRef.current?.children.forEach((node, i) => {
      const activation =
        reading > -0.99
          ? Math.max(0, 1 - Math.abs(i - reading) * 1.4)
          : Math.max(0, 1 - Math.abs(localCameraY - nodeYs[i]) / 5);
      // Pointed at, or passed by the satellite's ping
      const noticed = hovered.current === i ? 0.75 : 0;
      const pinged = Math.max(0, 1 - Math.abs(pingY - nodeYs[i]) / 1.6);
      lightNode(node as Group, Math.max(activation, noticed, pinged), charge, dt);
    });
  });

  return (
    <StationScope station="experience">
      <group ref={groupRef} position={stationPositions.experience}>
        <Billboard position={[0, 1, -2.5]}>
          <mesh material={materials.topHalo} scale={9}>
            <planeGeometry />
          </mesh>
        </Billboard>

        {/* The station the beam hangs from, behind it and off to the side */}
        <Spin position={[-4.6, 4.6, -13]}>
          <StationHull station="experience" height={3.4} theme={theme} />
          {/* Wings out to either side, a mast above and the beam's anchor below */}
          <SolarArray
            position={[1.1, 0.3, 0]}
            rotation={[0.9, 0, 0]}
            length={4.3}
            width={1.2}
            panels={3}
          />
          <group position={[-1.1, 0.3, 0]} rotation={[0, Math.PI, 0]}>
            <SolarArray rotation={[-0.9, 0, 0]} length={4.3} width={1.2} panels={3} />
          </group>
          <Antenna position={[0.2, 1.5, 0]} height={1.6} dish={0.45} />
          <NavLights lights={tetherLights} />
        </Spin>

        <group position={[0, 4 - beamLength / 2, 0]}>
          <mesh material={materials.core}>
            <cylinderGeometry args={[0.045, 0.045, beamLength, 12, 1, true]} />
          </mesh>
          <mesh material={materials.glow}>
            <cylinderGeometry args={[0.38, 0.38, beamLength, 24, 1, true]} />
          </mesh>
        </group>

        <group ref={nodesRef}>
          {nodeYs.map((y, i) => (
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
              <Billboard visible={false}>
                <mesh material={materials.halo}>
                  <planeGeometry />
                </mesh>
              </Billboard>
              {/* Never drawn: a comfortable target for the pointer */}
              <mesh
                visible={false}
                onPointerOver={(e) => hoverNode(e, tips[i], true, hovered, i)}
                onPointerOut={(e) => hoverNode(e, tips[i], false, hovered, i)}
                onClick={(e) => {
                  e.stopPropagation();
                  spawnPing(e.point);
                  focusOnPage(`role:${i}`);
                }}
              >
                <sphereGeometry args={[0.8, 12, 8]} />
              </mesh>
            </group>
          ))}
        </group>

        <group ref={satelliteRef} position={[2.3, 1.6, 0]}>
          <Model url={stationModels.experience!} height={1.6} theme={theme} />
          {/* Never drawn: the satellite's target for the pointer, along its length */}
          <mesh visible={false} rotation={[Math.PI / 2, 0, 0]} {...handlers}>
            <capsuleGeometry args={[0.8, 1.6, 4, 12]} />
          </mesh>
        </group>

        {/* The satellite's ping, running down the beam */}
        <Billboard ref={pingRef} visible={false}>
          <mesh material={materials.halo} scale={1.6}>
            <planeGeometry />
          </mesh>
        </Billboard>
      </group>
    </StationScope>
  );
}
