'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  QuadraticBezierCurve3,
  Quaternion,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three';

import globePoints from '../data/globePoints.json';
import { asGlow, createFresnelMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { stationInRange, useThemedMaterials, useWide } from '../stationHooks';
import { stationModels, stationPositions } from '../stations';
import { latLngToVector3, palettes, seededRandom, setUniform } from '../utils';
import { worldStore } from '../worldStore';

import type { WorldPalette, WorldTheme } from '../utils';

const radius = 2.25;
const home = { lat: 52.57, lng: -0.24 };
// UK & EU remote — arcs from Peterborough to a handful of European hubs
const cities = [
  { lat: 52.37, lng: 4.9 },
  { lat: 52.52, lng: 13.4 },
  { lat: 38.72, lng: -9.14 },
  { lat: 41.39, lng: 2.17 },
  { lat: 59.33, lng: 18.07 },
  { lat: 53.35, lng: -6.26 },
  { lat: 48.86, lng: 2.35 },
  { lat: 48.14, lng: 11.58 },
];

const dotVertex = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uTime;
  attribute float aSeed;
  varying float vFacing;
  varying float vLat;
  varying float vTwinkle;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 normal = normalize(mat3(modelMatrix) * normalize(position));
    vFacing = dot(normal, normalize(cameraPosition - world.xyz));
    vLat = position.y / ${radius.toFixed(2)};
    vTwinkle = 0.75 + 0.25 * sin(uTime * 1.5 + aSeed * 40.0);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 2.2 * uPixelRatio * (14.0 / -mv.z);
  }
`;

const dotFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uLight;
  varying float vFacing;
  varying float vLat;
  varying float vTwinkle;
  void main() {
    if (vFacing < -0.05) discard;
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.2, d) * smoothstep(-0.05, 0.35, vFacing) * vTwinkle;
    vec3 col = mix(uColorA, uColorB, smoothstep(-0.2, 0.9, vLat));
    gl_FragColor = vec4(col * mix(1.6, 1.0, uLight), alpha);
  }
`;

const exhaustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uActive;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vLife;
  void main() {
    float life = fract(uTime * 1.6 + aSeed);
    vLife = life;
    float angle = aSeed * 6.2831 * 7.0;
    float spread = 0.08 + life * 0.45;
    vec3 p = position + vec3(cos(angle) * spread, -life * 2.6, sin(angle) * spread);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uActive * (1.0 - life) * 26.0 * uPixelRatio * (6.0 / -mv.z);
  }
`;

const exhaustFragment = /* glsl */ `
  uniform vec3 uHot;
  uniform vec3 uCool;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d) * (1.0 - vLife);
    gl_FragColor = vec4(mix(uHot, uCool, vLife) * 2.2, alpha);
  }
`;

const buildMaterials = (p: WorldPalette) => ({
  dots: asGlow(
    new ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: 1 },
        uTime: { value: 0 },
        uColorA: { value: new Color(p.violet) },
        uColorB: { value: new Color(p.cyan) },
        uLight: { value: 0 },
      },
      vertexShader: dotVertex,
      fragmentShader: dotFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  ),
  atmosphere: createFresnelMaterial({ color: p.cyan, power: 3.2, intensity: 1.5 }),
  aura: createFresnelMaterial({ color: p.violet, power: 2.4, intensity: 1.1, backSide: true }),
  arc: createRingMaterial({
    colorA: p.cyan,
    colorB: p.pink,
    intensity: 1.8,
    speed: 0.35,
    opacity: 0.8,
  }),
  beacon0: createRingMaterial({ colorA: p.pink, colorB: p.violet, intensity: 3, speed: 0 }),
  beacon1: createRingMaterial({ colorA: p.pink, colorB: p.violet, intensity: 3, speed: 0 }),
  beacon2: createRingMaterial({ colorA: p.pink, colorB: p.violet, intensity: 3, speed: 0 }),
  exhaust: asGlow(
    new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uActive: { value: 0 },
        uPixelRatio: { value: 1 },
        uHot: { value: new Color('#fde68a') },
        uCool: { value: new Color(p.pink) },
        uLight: { value: 0 },
      },
      vertexShader: exhaustVertex,
      fragmentShader: exhaustFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  ),
});

function buildArcs() {
  const start = latLngToVector3(home.lat, home.lng, radius);
  return cities.map((city) => {
    const end = latLngToVector3(city.lat, city.lng, radius);
    const lift = radius + 0.25 + start.distanceTo(end) * 0.45;
    const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(lift);
    return new TubeGeometry(new QuadraticBezierCurve3(start, mid, end), 48, 0.011, 6, false);
  });
}

const launchDuration = 5.5;
const returnDuration = 1.6;

function updateRocket(rocket: Group, baseY: number, t: number, dt: number) {
  const since = worldStore.launchAt < 0 ? Infinity : t - worldStore.launchAt;
  if (since < launchDuration) {
    const lift = 0.9 * since * since;
    rocket.position.y = baseY + lift;
    rocket.position.x += (Math.random() - 0.5) * 0.02 * Math.min(since * 4, 1);
    rocket.rotation.z = Math.sin(t * 40) * 0.01;
    return Math.min(since * 3, 1);
  }
  if (since < launchDuration + returnDuration) {
    // Re-enter from below
    const k = (since - launchDuration) / returnDuration;
    rocket.position.y = baseY - 5 * (1 - k) * (1 - k);
    return 0;
  }
  easing.damp(rocket.position, 'y', baseY + Math.sin(t * 1.1) * 0.12, 0.3, dt);
  rocket.rotation.z = Math.sin(t * 0.7) * 0.05;
  return 0;
}

/** `/contact` — dotted holo-globe with a Peterborough beacon, and a rocket for sent messages */
export function ContactStation({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const globeRef = useRef<Group>(null);
  const beaconRef = useRef<Group>(null);
  const rocketRef = useRef<Group>(null);
  const wide = useWide();
  const materials = useThemedMaterials(buildMaterials, theme);
  const palette = palettes[theme];

  const { positions, seeds } = useMemo(() => {
    const random = seededRandom(5);
    const count = globePoints.length / 2;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const v = new Vector3();
    for (let i = 0; i < count; i++) {
      latLngToVector3(globePoints[i * 2], globePoints[i * 2 + 1], radius, v);
      positions.set([v.x, v.y, v.z], i * 3);
      seeds[i] = random();
    }
    return { positions, seeds };
  }, []);

  const exhaustSeeds = useMemo(() => {
    const random = seededRandom(9);
    return Float32Array.from({ length: 90 }, () => random());
  }, []);
  const exhaustPositions = useMemo(() => new Float32Array(90 * 3), []);

  const arcs = useMemo(() => buildArcs(), []);
  useEffect(() => () => arcs.forEach((arc) => arc.dispose()), [arcs]);

  const beaconPosition = useMemo(() => latLngToVector3(home.lat, home.lng, radius), []);
  const beaconQuaternion = useMemo(
    () =>
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), beaconPosition.clone().normalize()),
    [beaconPosition]
  );

  const rocketBase = wide ? { x: 2.8, y: 2.1, z: 1.2 } : { x: 1.5, y: 2.3, z: 1.5 };

  useFrame(({ camera, clock, viewport }, delta) => {
    if (!stationInRange(groupRef.current, camera, 'contact')) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 1 / 20);
    setUniform(materials.dots, 'uTime', t);
    setUniform(materials.dots, 'uPixelRatio', viewport.dpr);
    setUniform(materials.arc, 'uTime', t);
    setUniform(materials.exhaust, 'uTime', t);
    setUniform(materials.exhaust, 'uPixelRatio', viewport.dpr);

    const globe = globeRef.current;
    if (globe) {
      globe.rotation.y = -Math.PI / 2 + Math.sin(t * 0.12) * 0.35 + worldStore.pointerX * 0.2;
      globe.rotation.x = 0.62 + worldStore.pointerY * 0.08;
    }

    beaconRef.current?.children.forEach((ring, i) => {
      const phase = (t * 0.6 + i / 3) % 1;
      ring.scale.setScalar(0.1 + phase * 0.9);
      const material = (ring as Mesh).material as ShaderMaterial;
      setUniform(material, 'uOpacity', 1 - phase);
    });

    const rocket = rocketRef.current;
    if (rocket) {
      const thrust = updateRocket(rocket, rocketBase.y, t, dt);
      setUniform(materials.exhaust, 'uActive', thrust);
    }
  });

  return (
    <group ref={groupRef} position={stationPositions.contact}>
      <group ref={globeRef} position={[0, 0.5, 0]} rotation={[0.62, -Math.PI / 2, 0]}>
        <mesh>
          <sphereGeometry args={[radius * 0.985, 64, 48]} />
          <meshBasicMaterial color={theme === 'dark' ? '#070916' : '#dfe3f3'} />
        </mesh>
        <mesh material={materials.atmosphere} scale={1.005}>
          <sphereGeometry args={[radius, 64, 48]} />
        </mesh>
        <mesh material={materials.aura} scale={1.22}>
          <sphereGeometry args={[radius, 48, 32]} />
        </mesh>
        <points material={materials.dots}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
          </bufferGeometry>
        </points>
        {arcs.map((geometry, i) => (
          <mesh key={i} geometry={geometry} material={materials.arc} />
        ))}
        <group position={beaconPosition} quaternion={beaconQuaternion}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.012, 0.03, 0.7, 8]} />
            <meshBasicMaterial color={palette.pink} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color={palette.pink} toneMapped={false} />
          </mesh>
          <group ref={beaconRef}>
            {[materials.beacon0, materials.beacon1, materials.beacon2].map((material, i) => (
              <mesh key={i} rotation={[Math.PI / 2, 0, 0]} material={material}>
                <torusGeometry args={[0.32, 0.01, 6, 64]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      <group
        ref={rocketRef}
        position={[rocketBase.x, rocketBase.y, rocketBase.z]}
        rotation={[0, 0, 0.12]}
      >
        <Model url={stationModels.contact!} height={wide ? 2.1 : 1.5} theme={theme} />
        <points
          material={materials.exhaust}
          position={[0, wide ? -1 : -0.72, 0]}
          frustumCulled={false}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[exhaustPositions, 3]} />
            <bufferAttribute attach="attributes-aSeed" args={[exhaustSeeds, 1]} />
          </bufferGeometry>
        </points>
      </group>
    </group>
  );
}
