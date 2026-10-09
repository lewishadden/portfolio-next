'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  MathUtils,
  NormalBlending,
  Quaternion,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';

import { asGlow, createFresnelMaterial } from './materials';
import { Antenna, NavLights, partMaterials, SolarArray, Truss } from './parts';
import { cometAt, isFound, markFound, reportNearest, setSignalTime, signals } from './signalStore';
import { sunDirection } from './sky';
import { useThemedMaterials } from './stationHooks';
import { palettes } from './utils';
import { worldMode } from './worldMode';
import { emitCue } from './worldStore';

import type { Signal } from './signalStore';
import type { WorldPalette, WorldTheme } from './utils';

/* ------------------------------------------------------------------
   The signals hidden in free roam (see signals.ts): a probe, a supply
   capsule, an open-source relay and a comet out among the asteroids,
   plus the 404 derelict (LostStation, mounted for free roam). Each
   unfound one carries a faint amber glow, only in free roam, so the
   world's other views stay as they were. Flying within reach finds it.
   ------------------------------------------------------------------ */

const amber: Record<WorldTheme, string> = { dark: '#fbbf24', light: '#b45309' };

const tailUp = new Vector3(0, 1, 0);
const tailAway = new Vector3().copy(sunDirection).negate();

function glowTexture(color: string) {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.15, color);
    gradient.addColorStop(0.45, `${color}44`);
    gradient.addColorStop(1, `${color}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const tailVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 normal = normalize(mat3(modelMatrix) * normal);
    vFacing = abs(dot(normal, normalize(cameraPosition - world.xyz)));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const tailFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLight;
  uniform float uStrength;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    // Bright and white at the head (the cone's tip), fading and cooling down
    // the tail, and soft at its edges, with faint streamers along it
    float along = vUv.y;
    float streamers = 0.75 + 0.25 * sin(vUv.x * 62.0) * sin(vUv.x * 23.0 + 1.3);
    float alpha = pow(along, 3.0) * pow(vFacing, 2.2) * streamers * uStrength;
    vec3 col = mix(uColor, vec3(1.0), pow(along, 6.0) * 0.7);
    gl_FragColor = vec4(col * mix(1.5, 0.9, uLight), alpha);
  }
`;

const tailMaterial = (color: string, strength: number) =>
  asGlow(
    new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uLight: { value: 0 },
        uStrength: { value: strength },
      },
      vertexShader: tailVertex,
      fragmentShader: tailFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  );

const buildMaterials = (p: WorldPalette) => ({
  window: createFresnelMaterial({ color: p.violet, power: 2.2, intensity: 1.8 }),
  /** A narrow, bright ion tail and a broad, faint dust tail */
  ionTail: tailMaterial(p.cyan, 0.55),
  dustTail: tailMaterial('#fde68a', 0.22),
});

function Probe() {
  const materials = partMaterials();
  return (
    <group>
      <mesh material={materials.gold} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.6, 10]} />
      </mesh>
      <Antenna height={1.1} dish={1.9} position={[0, 0.3, 0]} />
      <SolarArray length={1.8} width={0.5} panels={2} position={[0.55, 0, 0]} />
      <SolarArray
        length={1.8}
        width={0.5}
        panels={2}
        position={[-0.55, 0, 0]}
        rotation={[0, Math.PI, 0]}
      />
      <NavLights lights={[{ position: [0, -0.4, 0.5], kind: 'red' }]} size={0.07} />
    </group>
  );
}

function Capsule({ window }: { window: ShaderMaterial }) {
  const materials = partMaterials();
  return (
    <group rotation={[0, 0, 0.5]}>
      <mesh material={materials.panel} castShadow>
        <capsuleGeometry args={[0.55, 1.3, 6, 16]} />
      </mesh>
      <mesh material={window} scale={[1.02, 0.18, 1.02]}>
        <sphereGeometry args={[0.56, 24, 12]} />
      </mesh>
      <NavLights
        lights={[
          { position: [0, 1.25, 0], kind: 'white' },
          { position: [0, -1.25, 0], kind: 'green', phase: 0.5 },
        ]}
        size={0.07}
      />
    </group>
  );
}

function Relay() {
  return (
    <group>
      <Truss length={3.2} size={0.3} position={[0, -1.6, 0]} />
      <SolarArray length={2.6} width={0.8} panels={3} position={[0.2, 0.6, 0]} />
      <SolarArray
        length={2.6}
        width={0.8}
        panels={3}
        position={[-0.2, 0.6, 0]}
        rotation={[0, Math.PI, 0]}
      />
      <Antenna height={1.4} dish={2.4} position={[0, 1.4, 0]} />
      <NavLights
        lights={[
          { position: [0, 2.9, 0], kind: 'cyan' },
          { position: [0, -1.6, 0], kind: 'violet', phase: 0.4 },
        ]}
        size={0.06}
      />
    </group>
  );
}

const tailQuaternion = new Quaternion().setFromUnitVectors(tailUp, tailAway);

function Comet({
  coma,
  ionTail,
  dustTail,
}: {
  coma: SpriteMaterial;
  ionTail: ShaderMaterial;
  dustTail: ShaderMaterial;
}) {
  return (
    <group>
      {/* The nucleus, blazing, inside its coma: a soft glow */}
      <mesh>
        <icosahedronGeometry args={[0.6, 1]} />
        <meshBasicMaterial color="#e6faff" toneMapped={false} />
      </mesh>
      <sprite material={coma} scale={9} />
      {/* The tails stream away from the sun, their tips on the nucleus */}
      <group quaternion={tailQuaternion}>
        <mesh material={ionTail} position={[0, 17, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[1.6, 34, 32, 1, true]} />
        </mesh>
        <mesh material={dustTail} position={[0.8, 12, 0]} rotation={[Math.PI, 0, -0.12]}>
          <coneGeometry args={[4.2, 24, 32, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}

/** Draws the signals and finds them as the explorer flies close */
export function Signals({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme);
  const glow = useMemo(() => {
    const map = glowTexture(amber[theme]);
    const comaMap = glowTexture(palettes[theme].cyan);
    return {
      map,
      comaMap,
      coma: new SpriteMaterial({
        map: comaMap,
        blending: theme === 'dark' ? AdditiveBlending : NormalBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.9,
      }),
      materials: signals.map(
        () =>
          new SpriteMaterial({
            map,
            blending: theme === 'dark' ? AdditiveBlending : NormalBlending,
            transparent: true,
            depthWrite: false,
            sizeAttenuation: false,
            fog: false,
            toneMapped: false,
            opacity: 0,
          })
      ),
    };
  }, [theme]);
  useEffect(
    () => () => {
      glow.map.dispose();
      glow.comaMap.dispose();
      glow.coma.dispose();
      glow.materials.forEach((material) => material.dispose());
    },
    [glow]
  );

  useFrame(({ camera, clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const exploring = worldMode.get().mode === 'explore';
    let nearest = Infinity;
    // The HUD and the sector map follow the comet by this clock
    setSignalTime(t);

    signals.forEach((signal, i) => {
      const node = group.children[i] as Group | undefined;
      if (!node) return;
      if (signal.id === 'comet') cometAt(t, node.position);
      const model = node.children[0];
      if (model && signal.id !== 'derelict') {
        model.rotation.set(t * 0.11 + i, t * 0.07 * (i % 2 ? 1 : -1), t * 0.05);
      }
      const sprite = node.children[node.children.length - 1] as Sprite;
      const found = isFound(signal.id);
      const distance = camera.position.distanceTo(node.position);
      // A faint amber glow, free roam only, until found
      const target = exploring && !found ? MathUtils.smoothstep(distance, 10, 40) : 0;
      const material = glow.materials[i];
      material.opacity = MathUtils.damp(material.opacity, target, 3, dt);
      sprite.visible = material.opacity > 0.01;
      sprite.scale.setScalar(0.03 * (0.85 + 0.15 * Math.sin(t * 2.6 + i)));
      if (!exploring || found) return;
      if (distance < signal.reach) {
        if (markFound(signal.id)) {
          emitCue(signals.every((s) => isFound(s.id)) ? 'complete' : 'found');
        }
        return;
      }
      nearest = Math.min(nearest, distance);
    });
    reportNearest(exploring ? nearest : Infinity);
  });

  return (
    <group ref={groupRef}>
      {signals.map((signal: Signal, i) => (
        <group key={signal.id} position={signal.position}>
          {signal.id === 'probe' && <Probe />}
          {signal.id === 'capsule' && <Capsule window={materials.window} />}
          {signal.id === 'relay' && <Relay />}
          {signal.id === 'comet' && (
            <Comet coma={glow.coma} ionTail={materials.ionTail} dustTail={materials.dustTail} />
          )}
          {/* The derelict is LostStation itself; it only needs the glow */}
          {signal.id === 'derelict' && <group />}
          <sprite material={glow.materials[i]} renderOrder={5} />
        </group>
      ))}
    </group>
  );
}
