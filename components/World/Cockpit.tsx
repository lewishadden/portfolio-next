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
   shows round the edges of the view. Two engine glows along the bottom,
   in from the corners, breathe with speed and flare when boosting, with a haze of
   heat between them while the boost burns, and the canopy's struts
   reach in faintly from the four corners, stopping well short of the
   reticle. Everything is laid out in
   screen terms (corners, edges) from the camera's field of view, so it
   stays put as the view widens with speed, and it is small: never a
   full-screen layer. Always mounted, so it compiles in the warm-up;
   shown only in free roam.
   ------------------------------------------------------------------ */

/** Speed (units/s) at which the engines burn their brightest */
const fullSpeed = 70;
/**
 * How far out from the middle the engines sit (-1..1 across the screen):
 * in from the corners, clear of the HUD's sector map and roam button
 */
const engineX = 0.6;

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
    // Sized by the screen's shorter side, so a phone held upright isn't swamped
    vScreen = aCentre + position.xy * aSize * min(uAspect, 1.0) * vec2(1.0 / uAspect, 1.0);
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
  #define ENGINE_X ${engineX.toFixed(2)}
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
    float engines = max(1.0 - abs(abs(vScreen.x) - ENGINE_X) * 3.2, 0.0);
    float alpha = ripples * engines * (1.0 - p.y) * uBoost * 0.22;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uRim * mix(1.3, 1.0, uLight), alpha);
  }
`;

/**
 * A canopy strut: from a corner of the screen (`aAnchor`) in towards the
 * middle, `uLength` screen half-heights long and tapering from `uWidth.x`
 * to `uWidth.y`, laid out at the screen's own aspect so it keeps its angle
 * on any screen. `aAlong` runs 0..1 out from the corner, `aAcross` -1..1
 */
const strutVertex = /* glsl */ `
  uniform vec2 uHalf;
  uniform float uAspect;
  uniform float uLength;
  uniform vec2 uWidth;
  attribute vec2 aAnchor;
  attribute float aAlong;
  attribute float aAcross;
  varying float vAlong;
  varying float vAcross;
  void main() {
    vAlong = aAlong;
    vAcross = aAcross;
    vec2 anchor = aAnchor * vec2(uAspect, 1.0);
    vec2 inward = normalize(-anchor);
    vec2 side = vec2(-inward.y, inward.x);
    float scale = min(uAspect, 1.0);
    vec2 at =
      anchor + (inward * aAlong * uLength + side * aAcross * mix(uWidth.x, uWidth.y, aAlong)) * scale;
    vec2 onScreen = at / vec2(uAspect, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(onScreen * uHalf, -1.0, 1.0);
  }
`;

const strutFragment = /* glsl */ `
  uniform vec3 uBody;
  uniform vec3 uEdge;
  uniform float uOpacity;
  varying float vAlong;
  varying float vAcross;
  void main() {
    // Solid at the corner, fading out well short of the middle, with a
    // thin lit edge along one side
    float fade = 1.0 - smoothstep(0.45, 1.0, vAlong);
    float sides = 1.0 - smoothstep(0.8, 1.0, abs(vAcross));
    float edge = smoothstep(0.55, 0.85, vAcross) * (1.0 - smoothstep(0.85, 1.0, vAcross));
    float alpha = uOpacity * fade * max(sides * 0.75, edge);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(mix(uBody, uEdge, edge), alpha);
  }
`;

/** The four struts, one in from each corner of the screen (just beyond it, so none ends at the edge) */
function strutGeometry() {
  const geometry = new BufferGeometry();
  const anchors = [
    [-1.02, 1.02],
    [1.02, 1.02],
    [-1.02, -1.02],
    [1.02, -1.02],
  ];
  const anchor = new Float32Array(anchors.length * 8);
  const along = new Float32Array(anchors.length * 4);
  const across = new Float32Array(anchors.length * 4);
  const index: number[] = [];
  anchors.forEach((corner, i) => {
    const ends = [
      [0, -1],
      [0, 1],
      [1, 1],
      [1, -1],
    ];
    ends.forEach(([a, b], v) => {
      anchor.set(corner, (i * 4 + v) * 2);
      along[i * 4 + v] = a;
      across[i * 4 + v] = b;
    });
    // Counter-clockwise on screen (across turns left of inward), so the faces aren't culled
    const a = i * 4;
    index.push(a, a + 2, a + 1, a, a + 3, a + 2);
  });
  // `position` is unused by the shader but sizes the draw
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(anchors.length * 12), 3));
  geometry.setAttribute('aAnchor', new BufferAttribute(anchor, 2));
  geometry.setAttribute('aAlong', new BufferAttribute(along, 1));
  geometry.setAttribute('aAcross', new BufferAttribute(across, 1));
  geometry.setIndex(index);
  return geometry;
}

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
  const strut = new ShaderMaterial({
    uniforms: {
      ...screenUniforms(),
      uLength: { value: 0.62 },
      uWidth: { value: [0.07, 0.014] },
      uBody: { value: new Color() },
      uEdge: { value: new Color() },
      uOpacity: { value: 0 },
    },
    vertexShader: strutVertex,
    fragmentShader: strutFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  return {
    glow,
    shimmer,
    strut,
    struts: strutGeometry(),
    // The engines sit just below the bottom of the view: only their glow shows
    glows: screenQuads([
      { centre: [-engineX, -1.06], size: [0.44, 0.44] },
      { centre: [engineX, -1.06], size: [0.44, 0.44] },
    ]),
    // A band along the bottom of the view, as wide as any screen and over both engines
    haze: screenQuads([{ centre: [0, -0.82], size: [2.2, 0.2] }]),
  };
}

type Parts = ReturnType<typeof createParts>;

const tones: Record<WorldTheme, { core: string; rim: string; body: string; edge: string }> = {
  dark: { core: '#e0fbff', rim: '#22d3ee', body: '#151a2e', edge: '#67e8f9' },
  light: { core: '#0e7490', rim: '#7c3aed', body: '#1e1b4b', edge: '#c4b5fd' },
};

/** How strongly the struts show (they are faint: the view is the point) */
const strutOpacity = 0.5;

function paint(parts: Parts, theme: WorldTheme) {
  const { core, rim, body, edge } = tones[theme];
  (parts.glow.uniforms.uCore.value as Color).set(core);
  (parts.glow.uniforms.uRim.value as Color).set(rim);
  (parts.shimmer.uniforms.uRim.value as Color).set(rim);
  (parts.strut.uniforms.uBody.value as Color).set(body);
  (parts.strut.uniforms.uEdge.value as Color).set(edge);
  applyGlowTheme(parts.glow, theme);
  applyGlowTheme(parts.shimmer, theme);
}

interface CockpitState {
  /** 0..1, eased: how hard the engines burn, and the boost on top */
  thrust: number;
  boost: number;
  /** 0..1, eased: the canopy fading in as free roam starts */
  canopy: number;
}

/** Lays every screen-sized material out for the camera's current field of view */
function fitScreen(parts: Parts, camera: PerspectiveCamera) {
  const halfH = Math.tan(MathUtils.degToRad(camera.fov) / 2);
  for (const material of [parts.glow, parts.shimmer, parts.strut]) {
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
    state.canopy = 0;
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
  state.canopy = motionLevel() === 'full' ? MathUtils.damp(state.canopy, 1, 4, dt) : 1;
  setTo(parts.strut, 'uOpacity', state.canopy * strutOpacity);
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
  const state = useRef<CockpitState>({ thrust: 0, boost: 0, canopy: 0 });
  const parts = useMemo(() => createParts(), []);
  useEffect(
    () => () => {
      parts.glow.dispose();
      parts.shimmer.dispose();
      parts.strut.dispose();
      parts.glows.dispose();
      parts.haze.dispose();
      parts.struts.dispose();
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
      {/* The canopy's frame, nearest the eye */}
      <mesh geometry={parts.struts} material={parts.strut} frustumCulled={false} renderOrder={31} />
    </group>
  );
}
