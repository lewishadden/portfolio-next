'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  Color,
  Group,
  Mesh,
  NormalBlending,
  Ray,
  ShaderMaterial,
  Sphere,
  Vector3,
} from 'three';

import { ambientTime } from './clock';
import { noiseGlsl } from './materials';
import { moon, planet, sunDirection } from './sky';
import { setUniform } from './utils';

import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Landmarks far beyond the stations: an ocean-and-ice giant with its
   moon below them, and the sun. They give every view a horizon, a
   sense of scale and a fixed direction, lit consistently by the sun.
   ------------------------------------------------------------------ */

const bodyVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;
  void main() {
    vPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const planetFragment = /* glsl */ `
  uniform vec3 uSun;
  uniform float uTime;
  uniform float uLight;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;
  ${noiseGlsl}
  void main() {
    vec3 n = normalize(vNormal);
    vec3 p = normalize(vPos);
    float lit = dot(n, uSun);
    float day = smoothstep(-0.08, 0.25, lit);

    // Oceans, shallows and ice caps
    float land = fbm(p * 2.4);
    float depth = smoothstep(-0.2, 0.45, land);
    vec3 ocean = mix(vec3(0.015, 0.05, 0.13), vec3(0.03, 0.22, 0.32), depth);
    float ice = smoothstep(0.62, 0.8, abs(p.y) + land * 0.15);
    vec3 surface = mix(ocean, vec3(0.78, 0.84, 0.92), ice);

    // Cloud bands drifting with latitude
    vec3 q = p + vec3(uTime * 0.004, 0.0, 0.0);
    float clouds = smoothstep(0.1, 0.75, fbm(q * vec3(3.0, 7.0, 3.0) + fbm(q * 3.5)));
    surface = mix(surface, vec3(0.86, 0.9, 0.98), clouds * 0.7);

    vec3 col = surface * (0.015 + day * 0.62);
    // Sun glint on open ocean
    vec3 h = normalize(uSun + normalize(vView));
    float glint = pow(max(dot(n, h), 0.0), 90.0) * (1.0 - clouds) * (1.0 - ice) * day;
    col += vec3(1.0, 0.92, 0.8) * glint * 0.9;
    // Terminator warms slightly, and the limb catches the atmosphere
    col += vec3(0.6, 0.25, 0.45) * smoothstep(0.3, 0.0, abs(lit)) * 0.08;
    float rim = pow(clamp(1.0 - dot(n, normalize(vView)), 0.0, 1.0), 3.0);
    col += vec3(0.25, 0.55, 1.0) * rim * (0.1 + day * 0.5);
    col = mix(col, col * 0.55 + vec3(0.62, 0.66, 0.85) * 0.45, uLight);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform vec3 uSun;
  uniform float uLight;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    float facing = clamp(dot(-n, normalize(vView)), 0.0, 1.0);
    float halo = pow(facing, 2.4);
    float lit = smoothstep(-0.35, 0.6, dot(-n, uSun) * -1.0);
    vec3 col = mix(vec3(0.45, 0.2, 0.75), vec3(0.35, 0.7, 1.0), lit);
    gl_FragColor = vec4(col * mix(1.1, 0.9, uLight), halo * (0.1 + 0.7 * lit));
  }
`;

const moonFragment = /* glsl */ `
  uniform vec3 uSun;
  uniform float uLight;
  varying vec3 vNormal;
  varying vec3 vPos;
  ${noiseGlsl}
  void main() {
    vec3 n = normalize(vNormal);
    vec3 p = normalize(vPos);
    float maria = smoothstep(-0.1, 0.4, fbm(p * 2.0));
    float craters = 1.0 - abs(fbm(p * 9.0));
    vec3 albedo = mix(vec3(0.42, 0.42, 0.46), vec3(0.24, 0.24, 0.28), maria) * (0.8 + 0.3 * craters);
    float day = smoothstep(-0.05, 0.3, dot(n, uSun));
    vec3 col = albedo * (0.012 + day * 0.85);
    col = mix(col, col * 0.6 + vec3(0.7, 0.72, 0.85) * 0.4, uLight);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const sunVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
    gl_Position = projectionMatrix * mv;
  }
`;

const sunFragment = /* glsl */ `
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float core = smoothstep(0.09, 0.0, r);
    float corona = exp(-r * 7.0) * 0.9 + exp(-r * 2.2) * 0.25;
    // Long thin rays, slowly shimmering
    float rays = pow(abs(cos(a * 4.0)), 60.0) * 0.6 + pow(abs(cos(a * 7.0 + 0.4)), 120.0) * 0.35;
    rays *= exp(-r * 2.6) * (0.85 + 0.15 * sin(uTime * 0.7 + a * 3.0));
    vec3 col = vec3(1.0, 0.94, 0.86) * (core * 6.0 + corona * 2.2 + rays * 2.4);
    float alpha = clamp(core + corona + rays, 0.0, 1.0);
    gl_FragColor = vec4(col * uIntensity, alpha * uIntensity);
  }
`;

const flareFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uRing;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float disc = smoothstep(1.0, 0.75, r) * (1.0 - uRing);
    float ring = smoothstep(0.08, 0.0, abs(r - 0.85)) * uRing;
    float alpha = (disc * 0.5 + ring) * uIntensity;
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;

const flares = [
  { at: 0.35, size: 0.06, color: '#a78bfa', ring: 0 },
  { at: 0.7, size: 0.035, color: '#22d3ee', ring: 0 },
  { at: 1.2, size: 0.12, color: '#f472b6', ring: 1 },
  { at: 1.55, size: 0.05, color: '#fde68a', ring: 0 },
  { at: 1.9, size: 0.18, color: '#818cf8', ring: 1 },
];

const sunPosition = new Vector3();
const projected = new Vector3();
const ghost = new Vector3();
const ray = new Ray();
const blockers = [
  new Sphere(planet.position, planet.radius),
  new Sphere(moon.position, moon.radius),
];

/**
 * Built once for the canvas's life: a theme change sets them in place
 * (themeLandmarks), so their shaders never compile again
 */
function buildMaterials() {
  const shared = { uSun: { value: sunDirection }, uLight: { value: 0 } };
  return {
    shared,
    /** How bright the lens flare's ghosts burn at full strength (per theme) */
    flare: { strength: 0.55 },
    planet: new ShaderMaterial({
      uniforms: { ...shared, uTime: { value: 0 } },
      defines: { OCTAVES: 4 },
      vertexShader: bodyVertex,
      fragmentShader: planetFragment,
      fog: false,
    }),
    atmosphere: new ShaderMaterial({
      uniforms: shared,
      vertexShader: bodyVertex,
      fragmentShader: atmosphereFragment,
      transparent: true,
      depthWrite: false,
      side: BackSide,
      blending: AdditiveBlending,
      fog: false,
    }),
    moon: new ShaderMaterial({
      uniforms: shared,
      defines: { OCTAVES: 4 },
      vertexShader: bodyVertex,
      fragmentShader: moonFragment,
      fog: false,
    }),
    sun: new ShaderMaterial({
      uniforms: { uIntensity: { value: 1 }, uTime: { value: 0 } },
      vertexShader: sunVertex,
      fragmentShader: sunFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      fog: false,
    }),
    flares: flares.map(
      (flare) =>
        new ShaderMaterial({
          uniforms: {
            uColor: { value: new Color(flare.color) },
            uIntensity: { value: 0 },
            uRing: { value: flare.ring },
          },
          vertexShader: sunVertex,
          fragmentShader: flareFragment,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: AdditiveBlending,
          toneMapped: false,
          fog: false,
        })
    ),
  };
}

type LandmarkMaterials = ReturnType<typeof buildMaterials>;

/**
 * A theme, in place: the light sky's paler bodies (uniforms), and its glows
 * laid on with normal blending, which is draw state rather than shader code
 */
function themeLandmarks(materials: LandmarkMaterials, theme: WorldTheme) {
  const light = theme === 'light';
  materials.shared.uLight.value = light ? 1 : 0;
  materials.atmosphere.blending = light ? NormalBlending : AdditiveBlending;
  materials.sun.blending = light ? NormalBlending : AdditiveBlending;
  setUniform(materials.sun, 'uIntensity', light ? 0.55 : 1);
  materials.flare.strength = light ? 0.25 : 0.55;
}

/** The giant planet, its moon, the sun and its lens flare */
export function Landmarks({ theme }: { theme: WorldTheme }) {
  const planetRef = useRef<Mesh>(null);
  const sunRef = useRef<Mesh>(null);
  const flaresRef = useRef<Group>(null);
  const [materials] = useState(buildMaterials);
  useLayoutEffect(() => themeLandmarks(materials, theme), [materials, theme]);

  useEffect(
    () => () => {
      materials.planet.dispose();
      materials.atmosphere.dispose();
      materials.moon.dispose();
      materials.sun.dispose();
      materials.flares.forEach((m) => m.dispose());
    },
    [materials]
  );

  useFrame((state) => {
    const { camera } = state;
    // Idle motion: holds at the still level, where nothing moves on its own
    const t = ambientTime(state);
    setUniform(materials.planet, 'uTime', t);
    setUniform(materials.sun, 'uTime', t);
    if (planetRef.current) planetRef.current.rotation.y = t * 0.002;

    // The sun sits at infinity: always the same direction from the camera
    sunPosition.copy(camera.position).addScaledVector(sunDirection, 820);
    sunRef.current?.position.copy(sunPosition);

    // Lens flare: ghosts along the line from the sun through the screen
    // centre, fading as the sun leaves the frame or slips behind the planet
    projected.copy(sunPosition).project(camera);
    ray.set(camera.position, sunDirection);
    const blocked = blockers.some((sphere) => ray.intersectsSphere(sphere));
    const inFront = projected.z < 1 && projected.z > -1;
    const centred = Math.max(0, 1 - Math.hypot(projected.x, projected.y) / 1.4);
    const strength = !blocked && inFront ? centred * centred : 0;
    flaresRef.current?.children.forEach((child, i) => {
      const flare = flares[i];
      ghost.set(-projected.x * flare.at + projected.x, -projected.y * flare.at + projected.y, 0.5);
      ghost.unproject(camera);
      child.position.copy(ghost);
      const distance = ghost.distanceTo(camera.position);
      child.scale.setScalar(flare.size * distance);
      child.visible = strength > 0.01;
      setUniform(materials.flares[i], 'uIntensity', strength * materials.flare.strength);
    });
  });

  return (
    <group>
      <group position={planet.position}>
        <mesh ref={planetRef} material={materials.planet} rotation={[0.25, 0, 0.18]}>
          <sphereGeometry args={[planet.radius, 96, 64]} />
        </mesh>
        <mesh material={materials.atmosphere} scale={1.045}>
          <sphereGeometry args={[planet.radius, 64, 48]} />
        </mesh>
      </group>
      <mesh material={materials.moon} position={moon.position}>
        <sphereGeometry args={[moon.radius, 64, 48]} />
      </mesh>
      <mesh
        ref={sunRef}
        material={materials.sun}
        scale={150}
        renderOrder={-5}
        frustumCulled={false}
      >
        <planeGeometry />
      </mesh>
      <group ref={flaresRef}>
        {materials.flares.map((material, i) => (
          <mesh key={i} material={material} renderOrder={20} frustumCulled={false}>
            <planeGeometry />
          </mesh>
        ))}
      </group>
    </group>
  );
}
