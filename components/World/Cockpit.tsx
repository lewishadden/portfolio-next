'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Color, MathUtils, ShaderMaterial } from 'three';

import { motionLevel } from '@/utils/motion';

import { applyGlowTheme, asGlow } from './materials';
import { worldMode } from './worldMode';
import { exploreInput, worldStore } from './worldStore';

import type { Camera, Group, Mesh, PerspectiveCamera } from 'three';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Free roam's ship, seen from its seat: a group that rides the camera
   (it copies camera.matrixWorld every frame) holding what of the ship
   shows round the edges of the view. Two engine glows at the lower
   corners breathe with speed and flare when boosting, with a haze of
   heat between them while the boost burns. Everything is laid out in
   screen terms (corners, edges) from the camera's field of view, so it
   stays put as the view widens with speed, and it is small: never a
   full-screen layer. Always mounted, so it compiles in the warm-up;
   shown only in free roam.
   ------------------------------------------------------------------ */

/** Speed (units/s) at which the engines burn their brightest */
const fullSpeed = 70;

/**
 * Lays a part out on the screen: `aCentre` (-1..1 from the middle, y up)
 * and `aSize` (in screen half-heights), with `position` running -1..1
 * across it. It sits one unit in front of the camera, sized from the field
 * of view (uHalf) so it keeps its place on screen
 */
const screenVertex = /* glsl */ `
  uniform vec2 uHalf;
  uniform float uAspect;
  attribute vec2 aCentre;
  attribute vec2 aSize;
  varying vec2 vLocal;
  varying vec2 vScreen;
  void main() {
    vLocal = position.xy;
    vScreen = aCentre + position.xy * aSize * vec2(1.0 / uAspect, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(vScreen * uHalf, -1.0, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uRim;
  uniform float uThrust;
  uniform float uBoost;
  uniform float uTime;
  uniform float uLight;
  varying vec2 vLocal;
  varying vec2 vScreen;
  void main() {
    float r = length(vLocal);
    if (r >= 1.0) discard;
    float halo = (1.0 - r) * (1.0 - r);
    float core = exp(-r * r * 16.0);
    float flicker = 0.93 + 0.07 * sin(uTime * 37.0 + vLocal.x * 2.0) * sin(uTime * 23.0);
    float glow = (halo * 0.5 + core * (0.55 + 0.9 * uBoost)) * uThrust * flicker;
    if (glow < 0.004) discard;
    vec3 color = mix(uRim, uCore, clamp(core * (0.6 + uBoost), 0.0, 1.0));
    gl_FragColor = vec4(color * mix(1.5, 1.0, uLight), min(glow, 1.0));
  }
`;

const shimmerFragment = /* glsl */ `
  uniform vec3 uRim;
  uniform float uBoost;
  uniform float uTime;
  uniform float uLight;
  varying vec2 vLocal;
  varying vec2 vScreen;
  void main() {
    // Rising ripples of heat, thickest over the engines and at the bottom
    vec2 p = vLocal * 0.5 + 0.5;
    float rise = p.y * 6.0 - uTime * 2.4;
    float wave = sin(rise + sin(vScreen.x * 9.0 + uTime * 3.1) * 1.4);
    float ripples = smoothstep(0.55, 1.0, wave) * (0.6 + 0.4 * sin(vScreen.x * 23.0 - uTime * 5.0));
    float engines = max(1.0 - abs(abs(vScreen.x) - 0.86) * 3.2, 0.0);
    float alpha = ripples * engines * (1.0 - p.y) * uBoost * 0.22;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uRim * mix(1.3, 1.0, uLight), alpha);
  }
`;

/** One quad per part: `position` -1..1 across it, with its centre and size on screen */
function screenQuads(parts: { centre: [number, number]; size: [number, number] }[]) {
  const geometry = new BufferGeometry();
  const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
  const position = new Float32Array(parts.length * 12);
  const centre = new Float32Array(parts.length * 8);
  const size = new Float32Array(parts.length * 8);
  const index: number[] = [];
  parts.forEach((part, i) => {
    for (let v = 0; v < 4; v++) {
      position.set([corners[v * 2], corners[v * 2 + 1], 0], (i * 4 + v) * 3);
      centre.set(part.centre, (i * 4 + v) * 2);
      size.set(part.size, (i * 4 + v) * 2);
    }
    const a = i * 4;
    index.push(a, a + 1, a + 2, a, a + 2, a + 3);
  });
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aCentre', new BufferAttribute(centre, 2));
  geometry.setAttribute('aSize', new BufferAttribute(size, 2));
  geometry.setIndex(index);
  return geometry;
}

const screenUniforms = () => ({ uHalf: { value: [1, 1] }, uAspect: { value: 1 } });

function createParts() {
  const glow = asGlow(
    new ShaderMaterial({
      uniforms: {
        ...screenUniforms(),
        uCore: { value: new Color() },
        uRim: { value: new Color() },
        uThrust: { value: 0 },
        uBoost: { value: 0 },
        uTime: { value: 0 },
        uLight: { value: 0 },
      },
      vertexShader: screenVertex,
      fragmentShader: glowFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
    })
  );
  const shimmer = asGlow(
    new ShaderMaterial({
      uniforms: {
        ...screenUniforms(),
        uRim: { value: new Color() },
        uBoost: { value: 0 },
        uTime: { value: 0 },
        uLight: { value: 0 },
      },
      vertexShader: screenVertex,
      fragmentShader: shimmerFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
    })
  );
  return {
    glow,
    shimmer,
    // The engines sit just below the lower corners: only their glow shows
    glows: screenQuads([
      { centre: [-0.86, -1.04], size: [0.44, 0.44] },
      { centre: [0.86, -1.04], size: [0.44, 0.44] },
    ]),
    // A band along the bottom of the view, as wide as any screen and over both engines
    haze: screenQuads([{ centre: [0, -0.82], size: [2.2, 0.2] }]),
  };
}

type Parts = ReturnType<typeof createParts>;

const tones: Record<WorldTheme, { core: string; rim: string }> = {
  dark: { core: '#e0fbff', rim: '#22d3ee' },
  light: { core: '#0e7490', rim: '#7c3aed' },
};

function paint(parts: Parts, theme: WorldTheme) {
  const { core, rim } = tones[theme];
  (parts.glow.uniforms.uCore.value as Color).set(core);
  (parts.glow.uniforms.uRim.value as Color).set(rim);
  (parts.shimmer.uniforms.uRim.value as Color).set(rim);
  applyGlowTheme(parts.glow, theme);
  applyGlowTheme(parts.shimmer, theme);
}

interface CockpitState {
  /** 0..1, eased: how hard the engines burn, and the boost on top */
  thrust: number;
  boost: number;
}

/** Lays every screen-sized material out for the camera's current field of view */
function fitScreen(parts: Parts, camera: PerspectiveCamera) {
  const halfH = Math.tan(MathUtils.degToRad(camera.fov) / 2);
  for (const material of [parts.glow, parts.shimmer]) {
    const half = material.uniforms.uHalf.value as number[];
    half[0] = halfH * camera.aspect;
    half[1] = halfH;
    material.uniforms.uAspect.value = camera.aspect;
  }
}

function step(
  group: Group,
  glows: Mesh,
  haze: Mesh,
  parts: Parts,
  state: CockpitState,
  camera: Camera,
  t: number,
  dt: number
) {
  const exploring = worldMode.get().mode === 'explore';
  group.visible = exploring;
  if (!exploring) {
    state.thrust = 0;
    state.boost = 0;
    return;
  }
  // Ride the camera: whatever moved it this frame (free roam, its shake) has
  camera.updateMatrixWorld();
  group.matrix.copy(camera.matrixWorld);
  group.matrixWorldNeedsUpdate = true;
  fitScreen(parts, camera as PerspectiveCamera);

  const thrusting =
    !!(exploreInput.forward || exploreInput.strafe || exploreInput.lift) &&
    !worldStore.autopilot &&
    !worldStore.docking;
  const speed = Math.min(worldStore.velocity / fullSpeed, 1);
  const boosting = exploreInput.boost && thrusting;
  state.thrust = MathUtils.damp(state.thrust, 0.18 + 0.55 * speed + (boosting ? 0.35 : 0), 6, dt);
  state.boost = MathUtils.damp(state.boost, boosting ? 1 : 0, boosting ? 8 : 4, dt);

  // Still: no flicker and no heat haze; the glows answer the controls only
  const still = motionLevel() === 'still';
  const time = still ? 0 : t;
  setTo(parts.glow, 'uThrust', state.thrust);
  setTo(parts.glow, 'uBoost', state.boost);
  setTo(parts.glow, 'uTime', time);
  setTo(parts.shimmer, 'uBoost', state.boost);
  setTo(parts.shimmer, 'uTime', time);
  glows.visible = state.thrust > 0.01;
  haze.visible = !still && state.boost > 0.02;
}

function setTo(material: ShaderMaterial, name: string, value: number) {
  material.uniforms[name].value = value;
}

/** Free roam's ship round the view (see above). Mount after ExploreControls */
export function Cockpit({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const glowsRef = useRef<Mesh>(null);
  const hazeRef = useRef<Mesh>(null);
  const state = useRef<CockpitState>({ thrust: 0, boost: 0 });
  const parts = useMemo(() => createParts(), []);
  useEffect(
    () => () => {
      parts.glow.dispose();
      parts.shimmer.dispose();
      parts.glows.dispose();
      parts.haze.dispose();
    },
    [parts]
  );
  useEffect(() => paint(parts, theme), [parts, theme]);

  useFrame(({ camera, clock }, delta) => {
    const group = groupRef.current;
    const glows = glowsRef.current;
    const haze = hazeRef.current;
    if (!group || !glows || !haze) return;
    step(
      group,
      glows,
      haze,
      parts,
      state.current,
      camera,
      clock.elapsedTime,
      Math.min(delta, 0.05)
    );
  });

  return (
    <group ref={groupRef} matrixAutoUpdate={false}>
      <mesh
        ref={hazeRef}
        geometry={parts.haze}
        material={parts.shimmer}
        frustumCulled={false}
        renderOrder={29}
      />
      <mesh
        ref={glowsRef}
        geometry={parts.glows}
        material={parts.glow}
        frustumCulled={false}
        renderOrder={30}
      />
    </group>
  );
}
