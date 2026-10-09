'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import {
  AdditiveBlending,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
} from 'three';

import { asGlow, createHaloMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { HabitatRing, NavLights, SolarArray, Spin } from '../parts';
import { StationScope } from '../power';
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
import { seededRandom, setUniform } from '../utils';

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

/** Seconds the helmet's spin takes */
const spinTime = 1.3;

/**
 * The motes drifting up round the helmet, one instanced draw: cyan or
 * violet each (`aTone`), and like the station's other glows they follow its
 * power (`uCharge`)
 */
function createMoteMaterial(p: WorldPalette) {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uColorA: { value: new Color(p.cyan) },
        uColorB: { value: new Color(p.violet) },
        uCharge: { value: 1 },
        uLight: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aTone;
        varying float vTone;
        void main() {
          vTone = aTone;
          vec4 local = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            local = instanceMatrix * local;
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * local;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorA, uColorB;
        uniform float uCharge, uLight;
        varying float vTone;
        void main() {
          gl_FragColor = vec4(mix(uColorA, uColorB, vTone) * max(uCharge, 1.0), 0.85 * min(uCharge, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  );
}

interface Mote {
  angle: number;
  radius: number;
  speed: number;
  offset: number;
  size: number;
}

const moteCount = 26;
const moteDummy = new Object3D();

/** Places every mote for clock time `t`: each rises through the rings and starts again below */
function placeMotes(mesh: InstancedMesh | null, motes: Mote[], t: number) {
  if (!mesh) return;
  motes.forEach((m, i) => {
    const y = ((t * m.speed + m.offset) % 5) - 2.5;
    moteDummy.position.set(Math.cos(m.angle + t * 0.1) * m.radius, y, Math.sin(m.angle) * m.radius);
    moteDummy.scale.setScalar(m.size);
    moteDummy.updateMatrix();
    mesh.setMatrixAt(i, moteDummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

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
  motes: createMoteMaterial(p),
});

/** `/about` — the helmet, circled by holographic data rings and a scanning plane */
export function AboutStation({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const helmetRef = useRef<Group>(null);
  const ringsRef = useRef<Group>(null);
  const scanRef = useRef<Group>(null);
  const motesRef = useRef<InstancedMesh>(null);
  const materials = useThemedMaterials(buildMaterials, theme, 'about');
  const reaction = useRef(createReaction());
  const handlers = useReactionHandlers(reaction, helmetTip, spinTime);

  const motes = useMemo<Mote[]>(() => {
    const random = seededRandom(41);
    return Array.from({ length: moteCount }, () => ({
      angle: random() * Math.PI * 2,
      radius: 1.8 + random() * 1.6,
      speed: 0.25 + random() * 0.5,
      offset: random() * 6,
      size: 0.025 + random() * 0.04,
    }));
  }, []);
  // Every third mote is violet, the rest cyan
  const moteGeometry = useMemo(() => {
    const geometry = new SphereGeometry(1, 8, 8);
    const tones = Float32Array.from({ length: moteCount }, (_, i) => (i % 3 ? 0 : 1));
    geometry.setAttribute('aTone', new InstancedBufferAttribute(tones, 1));
    return geometry;
  }, []);
  useEffect(() => () => moteGeometry.dispose(), [moteGeometry]);

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
      const spin = trickProgress(r, spinTime);
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

    placeMotes(motesRef.current, motes, t);
  });

  return (
    <StationScope station="about">
      <group ref={groupRef} position={stationPositions.about}>
        {/* The crew habitat, cupola turned towards the visitor */}
        <group position={[-3.4, 3.7, -15]} rotation={[0.2, 0.55, 0.08]}>
          <Spin>
            <StationHull station="about" height={3.2} theme={theme} />
            {/* Its habitat ring, turning about the module for gravity */}
            <Spin speed={0.32}>
              <HabitatRing rotation={[Math.PI / 2, 0, 0]} radius={2.9} tube={0.16} spokes={4} />
            </Spin>
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

        <Billboard position={[0, 0, -3]}>
          <mesh material={materials.halo} scale={9}>
            <planeGeometry />
          </mesh>
        </Billboard>

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

        <instancedMesh
          ref={motesRef}
          args={[moteGeometry, materials.motes, moteCount]}
          frustumCulled={false}
          onUpdate={(mesh) => placeMotes(mesh, motes, 0)}
        />

        <group ref={helmetRef} {...handlers}>
          <Model url={stationModels.about!} height={2.8} theme={theme} />
        </group>
      </group>
    </StationScope>
  );
}
