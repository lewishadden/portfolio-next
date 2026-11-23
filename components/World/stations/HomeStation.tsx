'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { Color, Group, Mesh, ShaderMaterial } from 'three';

import { createHaloMaterial, createRingMaterial, noiseGlsl } from '../materials';
import { Model } from '../Model';
import { StationConsole } from './StationConsole';
import { skyMap } from '../Nebula';
import { Antenna, NavLights, SolarArray } from '../parts';
import { StationScope } from '../power';
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

/** Seconds the astronaut's barrel roll takes (the portal ripples with it) */
const rollTime = 1.2;

/**
 * The portal's surface: a slow whirl of light with a dark eye, and through
 * it the real sky (the baked dome, shared by Nebula), bent round the middle
 * the way a mass bends light. A click on the astronaut sends a ripple out
 * across it. Normal blending, so it reads as a window rather than a glow.
 */
function createPortalMaterial(p: WorldPalette) {
  return new ShaderMaterial({
    defines: { OCTAVES: 3 },
    uniforms: {
      uSky: skyMap,
      uTime: { value: 0 },
      uRipple: { value: 0 },
      uColorA: { value: new Color(p.violet) },
      uColorB: { value: new Color(p.cyan) },
      uLight: { value: 0 },
      uCharge: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vRight;
      varying vec3 vUp;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vRight = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
        vUp = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      ${noiseGlsl}
      uniform sampler2D uSky;
      uniform float uTime, uRipple, uLight, uCharge;
      uniform vec3 uColorA, uColorB;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vRight;
      varying vec3 vUp;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        // A ripple running out from the middle after a click
        float front = r - uRipple * 1.25;
        float wave = uRipple > 0.0
          ? sin(front * 28.0) * exp(-front * front * 30.0) * (1.0 - uRipple)
          : 0.0;
        // The whirl: inner rings turn faster
        float a = atan(p.y, p.x) + 1.4 / (r + 0.3) + uTime * 0.35;
        vec2 q = vec2(cos(a), sin(a)) * (r + wave * 0.06);
        float n = fbm(vec3(q * 2.4, uTime * 0.07));
        float arms = 0.5 + 0.5 * sin(a * 3.0 + n * 3.0);
        // The sky behind it, bent towards the middle, sampled as the dome is
        vec3 view = normalize(vWorld - cameraPosition);
        vec3 dir = normalize(view - (vRight * q.x + vUp * q.y) * (0.22 / (r + 0.25)));
        float lon = atan(dir.z, dir.x);
        float lat = asin(clamp(dir.y, -1.0, 1.0));
        vec3 sky = texture2D(uSky, vec2(fract(lon / 6.2831853 + 0.5), lat / 3.1415926 + 0.5)).rgb;
        vec3 swirl = mix(uColorA, uColorB, arms) * (0.2 + 0.55 * (1.0 - r) * (1.0 - r)) * (0.5 + n);
        vec3 col = sky * mix(1.6, 1.0, uLight) + swirl * mix(1.0, 0.6, uLight);
        // A dark eye in the middle, a bright lip where it meets the ring
        col *= mix(0.12, 1.0, smoothstep(0.0, 0.32, r));
        col += uColorB * (pow(r, 9.0) * 1.1 + abs(wave) * 1.6);
        float alpha = smoothstep(1.0, 0.9, r) * mix(0.9, 0.75, uLight) * min(uCharge, 1.0);
        gl_FragColor = vec4(col * max(uCharge, 1.0), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

const buildMaterials = (p: WorldPalette) => ({
  portal: createRingMaterial({ colorA: p.violet, colorB: p.cyan, intensity: 2.6, speed: 0.06 }),
  surface: createPortalMaterial(p),
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
  const materials = useThemedMaterials(buildMaterials, theme, 'home');
  const reaction = useRef(createReaction());
  const handlers = useReactionHandlers(reaction, astronautTip, rollTime);

  useFrame(({ camera, clock }, delta) => {
    if (!stationInRange(groupRef.current, camera, 'home')) return;
    const t = clock.elapsedTime;
    const r = reaction.current;
    stepReaction(r, t, Math.min(delta, 0.05));
    setUniform(materials.portal, 'uTime', t);
    setUniform(materials.orbit, 'uTime', t);
    setUniform(materials.outer, 'uTime', t);
    setUniform(materials.surface, 'uTime', t);
    // The portal ripples with the barrel roll
    setUniform(materials.surface, 'uRipple', Math.max(trickProgress(r, rollTime * 1.6), 0));

    const float = floatRef.current;
    if (float) {
      // Watches the pointer, leans in when hovered, barrel-rolls when clicked
      const roll = trickProgress(r, rollTime);
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
    <StationScope station="home">
      <group ref={groupRef} position={stationPositions.home}>
        <StationConsole
          station="home"
          title="Orientation display"
          subtitle="Destinations and featured work"
          position={[2.6, -1.6, 0.4]}
          theme={theme}
        />
        <Billboard position={[0, 0, -3]}>
          <mesh material={materials.halo} scale={10}>
            <planeGeometry />
          </mesh>
        </Billboard>
        <Billboard position={[1.4, -1.2, -3.4]}>
          <mesh material={materials.haloCyan} scale={7}>
            <planeGeometry />
          </mesh>
        </Billboard>

        <group rotation={[0.18, -0.22, 0]} position={[0, 0, -1.6]}>
          <mesh material={materials.surface}>
            <circleGeometry args={[2.74, 128]} />
          </mesh>
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
    </StationScope>
  );
}
