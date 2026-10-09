'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  MathUtils,
  Color,
  DataTexture,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  LineBasicMaterial,
  Matrix4,
  NormalBlending,
  Quaternion,
  ShaderMaterial,
  Sphere,
  SRGBColorSpace,
  Vector3,
} from 'three';

import { motionLevel } from '@/utils/motion';

import { iconSvg, useIconCollections } from '../icons';
import { asGlow, chargeWith, createFresnelMaterial, noiseGlsl } from '../materials';
import { NavLights, SolarArray, Spin } from '../parts';
import { spawnPing } from '../Pings';
import { StationScope, stationPower } from '../power';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { stationPositions } from '../stations';
import { StationHull } from '../StationHull';
import { orbitTilts } from '../skillsOrbit';
import { palettes, setUniform } from '../utils';
import { queueUpload, useWarmupTask } from '../warmup';
import { focusOnPage, onShowcase, setWorldHover, worldStore, worldTip } from '../worldStore';

import { repaintFor, useStillRepaint } from './stillFrames';

import type { RefObject } from 'react';
import type { IconifyJSON } from '@iconify/react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Camera, InstancedMesh, LineSegments, Object3D, Texture } from 'three';
import type { NavLight } from '../parts';
import type { WorldPalette, WorldTheme } from '../utils';

type SkillIcon = { name: string; icon: string; category: string; level: number };

const planetFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uLight;
  uniform float uCharge;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  ${noiseGlsl}
  void main() {
    vec3 p = normalize(vPos);
    float warp = fbm(p * 2.2 + vec3(0.0, 0.0, uTime * 0.03));
    float bands = sin(p.y * 14.0 + warp * 3.2 + uTime * 0.05);
    float storm = smoothstep(0.55, 0.9, fbm(p * 4.0 + vec3(uTime * 0.02)));
    vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * bands);
    col = mix(col, uColorC, storm * 0.6);
    float light = clamp(dot(normalize(vNormal), normalize(vec3(-0.6, 0.5, 0.8))), 0.0, 1.0);
    col *= mix(0.25, 1.15, light);
    // The station's power: its bands glow dimly in standby, the rim goes out, and both surge on
    float on = clamp(uCharge, 0.0, 1.0);
    col *= mix(0.35, 1.0, on) * mix(1.0, max(uCharge, 1.0), 0.5);
    // Clamped: a head-on dot can round past 1, and pow() of a negative base is NaN
    float rim = pow(clamp(1.0 - dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 3.0);
    col += uColorB * rim * mix(1.4, 0.6, uLight) * on * max(uCharge, 1.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const planetVertex = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ringFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uLight;
  uniform float uCharge;
  varying vec2 vUv;
  varying float vRadius;
  void main() {
    float r = vRadius;
    float bands = 0.5 + 0.5 * sin(r * 38.0) * sin(r * 11.0 + 1.3);
    float gap = smoothstep(0.52, 0.55, r) * (1.0 - smoothstep(0.6, 0.63, r));
    float edge = smoothstep(0.0, 0.08, r) * smoothstep(1.0, 0.85, r);
    float alpha = edge * (0.25 + bands * 0.55) * (1.0 - gap * 0.85);
    vec3 col = mix(uColorA, uColorB, r);
    gl_FragColor = vec4(
      col * mix(1.5, 1.0, uLight) * max(uCharge, 1.0),
      alpha * mix(0.8, 0.7, uLight) * min(uCharge, 1.0)
    );
  }
`;

const ringVertex = /* glsl */ `
  uniform float uInner;
  uniform float uOuter;
  varying vec2 vUv;
  varying float vRadius;
  void main() {
    vUv = uv;
    vRadius = (length(position.xy) - uInner) / (uOuter - uInner);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const outpostLights: NavLight[] = [
  { position: [0, 1.05, 0], kind: 'white' },
  { position: [-0.9, 0, 0], kind: 'red' },
  { position: [0.9, 0, 0], kind: 'green' },
];

const ringInner = 2.6;
const ringOuter = 3.9;

const buildMaterials = (p: WorldPalette) => ({
  planet: new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new Color(p.violet).multiplyScalar(0.55) },
      uColorB: { value: new Color(p.cyan) },
      uColorC: { value: new Color(p.pink) },
      uLight: { value: 0 },
      uCharge: { value: 1 },
    },
    defines: { OCTAVES: 4 },
    vertexShader: planetVertex,
    fragmentShader: planetFragment,
  }),
  atmosphere: createFresnelMaterial({ color: p.cyan, power: 2.2, intensity: 2.2 }),
  ring: asGlow(
    new ShaderMaterial({
      uniforms: {
        uColorA: { value: new Color(p.violet) },
        uColorB: { value: new Color(p.cyan) },
        uInner: { value: ringInner },
        uOuter: { value: ringOuter },
        uLight: { value: 0 },
        uCharge: { value: 1 },
      },
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    })
  ),
  badges: createBadgeMaterial(p === palettes.dark),
});

/* ------------------------------------------------------------------
   Skill badges. Every icon is drawn once into one atlas (one texture,
   uploaded through queueUpload once its images have all decoded), and
   every badge is an instance of one mesh: a quad turned to face the
   camera, whose disc, gradient ring and monochrome icons are coloured by
   uniforms, so a theme change recolours them without redrawing anything.
   The mesh mounts with the station (so its Precompiled pass compiles it)
   on a 1×1 placeholder, and the icons fade in once the atlas is up. One
   draw, where there was a sprite (and a texture upload) per skill.
   ------------------------------------------------------------------ */

/** Atlas cell size in px, and cells per row */
const atlasCell = 128;
const atlasColumns = 8;
/** An icon's inset in its cell, so mip levels don't bleed into its neighbours */
const atlasPad = 8;
/** Near white: icons drawn in it were monochrome (currentColor), inked by uniform */
const monoInk = '#fffffe';
/** Icons drawn into the atlas a frame */
const atlasBatch = 6;
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
/** Share of the badge's width the icon's cell spans (the icon itself is 0.52, inside the inset) */
const iconSpan = (0.52 * atlasCell) / (atlasCell - 2 * atlasPad);

/** A transparent 1×1 stand-in until the atlas is up (the same sampler, so nothing recompiles) */
let placeholder: DataTexture | null = null;
function placeholderTexture() {
  if (!placeholder) {
    placeholder = new DataTexture(new Uint8Array(4), 1, 1);
    placeholder.colorSpace = SRGBColorSpace;
    placeholder.needsUpdate = true;
  }
  return placeholder;
}

/**
 * Draws every badge's icon (or, without one, its first two letters) into
 * one canvas, a cell each in badge order, once all the icons have decoded.
 * `mono` marks the cells to ink in the theme's colour
 */
async function drawAtlas(badges: { name: string; icon: string }[], collections: IconifyJSON[]) {
  const rows = Math.max(1, Math.ceil(badges.length / atlasColumns));
  const mono = new Float32Array(badges.length).fill(1);
  const images = await Promise.all(
    badges.map(async ({ icon }, i) => {
      const svg = iconSvg(collections, icon, monoInk, atlasCell);
      if (!svg) return null;
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      try {
        await image.decode();
      } catch {
        return null;
      }
      mono[i] = svg.includes(monoInk) ? 1 : 0;
      return image;
    })
  );
  const canvas = document.createElement('canvas');
  canvas.width = atlasColumns * atlasCell;
  canvas.height = rows * atlasCell;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${atlasCell / 2}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const inner = atlasCell - 2 * atlasPad;
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const x = (i % atlasColumns) * atlasCell;
      const y = Math.floor(i / atlasColumns) * atlasCell;
      if (image) ctx.drawImage(image, x + atlasPad, y + atlasPad, inner, inner);
      else
        ctx.fillText(
          badges[i].name.slice(0, 2).toUpperCase(),
          x + atlasCell / 2,
          y + atlasCell / 2
        );
      // An SVG rasterises as it is drawn: a few a frame, so a flight in never stalls on them
      if (i % atlasBatch === atlasBatch - 1) await nextFrame();
    }
  }
  return { canvas, rows, mono };
}

const badgeVertex = /* glsl */ `
  attribute float aCell;
  attribute float aMono;
  attribute float aAlpha;
  varying vec2 vUv;
  varying float vCell;
  varying float vMono;
  varying float vAlpha;
  void main() {
    vUv = uv;
    vCell = aCell;
    vMono = aMono;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const badgeFragment = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec2 uGrid;
  uniform float uIcons;
  uniform vec3 uFill;
  uniform float uFillAlpha;
  uniform vec3 uRingA;
  uniform vec3 uRingB;
  uniform vec3 uInk;
  uniform float uCharge;
  varying vec2 vUv;
  varying float vCell;
  varying float vMono;
  varying float vAlpha;
  // Colour c at alpha a laid over b (straight alpha)
  vec4 over(vec3 c, float a, vec4 b) {
    float o = a + b.a * (1.0 - a);
    return vec4((c * a + b.rgb * b.a * (1.0 - a)) / max(o, 1e-4), o);
  }
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float aa = fwidth(d) + 0.004;
    // The disc, and the ring round its edge (a gradient from top left to bottom right)
    float disc = 1.0 - smoothstep(0.9375 - aa, 0.9375 + aa, d);
    float ring = smoothstep(0.906 - aa, 0.906 + aa, d) * (1.0 - smoothstep(0.969 - aa, 0.969 + aa, d));
    vec3 ringColour = mix(uRingA, uRingB, clamp((vUv.x + 1.0 - vUv.y) * 0.5, 0.0, 1.0));
    vec4 badge = over(ringColour, ring, vec4(uFill, disc * uFillAlpha));
    // The icon, from its cell (row 0 is the top of the canvas, which is v = 1)
    vec2 q = (vUv - 0.5) / ${iconSpan.toFixed(4)} + 0.5;
    float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
    float cell = floor(vCell + 0.5);
    float row = floor(cell / uGrid.x);
    float column = cell - row * uGrid.x;
    q = clamp(q, 0.0, 1.0);
    vec4 icon = texture2D(uAtlas, vec2((column + q.x) / uGrid.x, 1.0 - (row + 1.0 - q.y) / uGrid.y));
    badge = over(mix(icon.rgb, uInk, vMono), icon.a * inside * uIcons, badge);
    // The station's power: dark in standby, flickering and surging as it comes on
    float alpha = badge.a * vAlpha * min(uCharge, 1.0);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(badge.rgb * max(uCharge, 1.0), alpha);
  }
`;

function createBadgeMaterial(dark: boolean) {
  return new ShaderMaterial({
    uniforms: {
      uAtlas: { value: placeholderTexture() },
      uGrid: { value: [atlasColumns, 1] },
      uIcons: { value: 0 },
      uFill: { value: new Color(dark ? '#0c0e20' : '#ffffff') },
      uFillAlpha: { value: dark ? 0.92 : 0.95 },
      uRingA: { value: new Color(dark ? '#a78bfa' : '#7c3aed') },
      uRingB: { value: new Color(dark ? '#22d3ee' : '#0e7490') },
      uInk: { value: new Color(dark ? '#e0e7ff' : '#312e81') },
      uCharge: { value: 1 },
    },
    vertexShader: badgeVertex,
    fragmentShader: badgeFragment,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/** An orbit's line: a circle, each point marked with how far round it is (0..1) */
function orbitGeometry(radius: number) {
  const points: number[] = [];
  const around: number[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    points.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    around.push(i / 128);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  geometry.setAttribute('aAround', new Float32BufferAttribute(around, 1));
  return geometry;
}

/**
 * A category's constellation: lines from each badge to the one two along
 * (a star polygon through the badges, `[angle, radius]` each), in the
 * badges' own frame so it turns with them
 */
function constellationGeometry(stars: [number, number][]) {
  const points: number[] = [];
  const at = ([angle, radius]: [number, number]) => [
    Math.cos(angle) * radius,
    0,
    Math.sin(angle) * radius,
  ];
  const count = stars.length;
  const step = count > 4 ? 2 : 1;
  for (let i = 0; i < count; i++) points.push(...at(stars[i]), ...at(stars[(i + step) % count]));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  return geometry;
}

/**
 * A skill's level (0..100) in its badge: stronger skills are bigger
 * badges, and orbit higher (further out from the giant), weaker ones
 * smaller and lower
 */
const levelScale = (level: number) =>
  0.32 + 0.16 * Math.pow(MathUtils.clamp(level, 0, 100) / 100, 1.5);
const levelLift = (level: number) => MathUtils.clamp((level - 80) / 100, -0.45, 0.2) * 0.8;
/** How much a pointed badge swells */
const swell = 1.6;

/*
 * The orbit lines carry each category's average level as a lit arc, as
 * long a share of the circle as the level (87% of it for an 87 average),
 * centred on the bottom of the view: seen square on, as the camera sees
 * the category being read, the orbit reads as a gauge open at the top.
 * The category being read lights its arc fully
 */
const orbitVertex = /* glsl */ `
  attribute float aAround;
  varying float vAround;
  void main() {
    vAround = aAround;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const orbitFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uArc;
  uniform float uOpacity;
  uniform float uLevel;
  uniform float uCentre;
  uniform float uLit;
  uniform float uLight;
  uniform float uCharge;
  varying float vAround;
  void main() {
    // 0 at the arc's centre, 1 at the far side of the orbit
    float off = abs(fract(vAround - uCentre + 0.5) - 0.5) * 2.0;
    float arc = 1.0 - smoothstep(uLevel - 0.015, uLevel, off);
    vec3 colour = mix(uColor, uArc * mix(1.6, 1.0, uLight), arc * mix(0.55, 1.0, uLit));
    float alpha = uOpacity * (1.0 + arc * mix(0.3, 1.2, uLit));
    gl_FragColor = vec4(colour * max(uCharge, 1.0), min(alpha, 1.0) * min(uCharge, 1.0));
  }
`;

function createOrbitMaterial(theme: WorldTheme, level: number) {
  const dark = theme === 'dark';
  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(dark ? '#8b5cf6' : '#6d28d9') },
      uArc: { value: new Color(palettes[theme].cyan) },
      uOpacity: { value: 0 },
      uLevel: { value: level },
      uCentre: { value: 0 },
      uLit: { value: 0 },
      uLight: { value: dark ? 0 : 1 },
      uCharge: { value: 1 },
    },
    vertexShader: orbitVertex,
    fragmentShader: orbitFragment,
    transparent: true,
    depthWrite: false,
  });
  material.userData.base = dark ? 0.3 : 0.25;
  // The orbits follow the station's power, as its glows do
  chargeWith(material, stationPower.skills.charge);
  return material;
}

const viewDown = new Vector3();
const orbitTurn = new Quaternion();

/**
 * Eases an orbit's lit arc round to the bottom of the view (`down`, the
 * camera's down in the orbit's own frame). Seen edge on, it holds
 */
function centreArc(material: ShaderMaterial, down: Vector3, dt: number) {
  const across = Math.hypot(down.x, down.z);
  const target = Math.atan2(down.z, down.x) / (Math.PI * 2);
  const uniform = material.uniforms.uCentre;
  if (!material.userData.centred) {
    material.userData.centred = true;
    uniform.value = target;
    return;
  }
  const weight = MathUtils.smoothstep(across, 0.05, 0.3);
  const turn = ((((target - uniform.value + 0.5) % 1) + 1) % 1) - 0.5;
  uniform.value += turn * (1 - Math.exp(-2.5 * dt)) * weight;
}

/** A badge: its skill, its orbit (an index into the orbits) and where round it it sits */
interface Badge {
  name: string;
  icon: string;
  category: string;
  orbit: number;
  angle: number;
  radius: number;
  /** Its size at rest (from its level) */
  size: number;
}

/** The badges' state between frames (a plain object: it changes every frame) */
interface BadgeState {
  /** Per badge: size, opacity, view depth and position (in the badge mesh's frame, x y z) */
  scale: Float32Array;
  alpha: Float32Array;
  depth: Float32Array;
  local: Float32Array;
  /** Draw order, back to front: instance slot → badge */
  order: Int32Array;
  /** How far the icons have faded in, 0..1 */
  icons: number;
}

/** The badge atlas once it is on the GPU: rows of cells, and which cells to ink */
interface BadgeAtlas {
  texture: Texture;
  rows: number;
  mono: Float32Array;
}

/** The badges' state, made (or remade, should the skills change) on first use */
function badgeStateFor(ref: { current: BadgeState | null }, count: number) {
  if (ref.current?.order.length !== count) {
    ref.current = {
      scale: new Float32Array(count).fill(0.44),
      alpha: new Float32Array(count).fill(1),
      depth: new Float32Array(count),
      local: new Float32Array(count * 3),
      order: Int32Array.from({ length: count }, (_, i) => i),
      icons: 0,
    };
  }
  return ref.current;
}

/** The icons fade in once the atlas is up (0..1) */
function fadeIcons(state: BadgeState, atlas: BadgeAtlas | null, dt: number) {
  state.icons = atlas ? Math.min(1, state.icons + dt / 0.4) : 0;
  return state.icons;
}

/** Sets the badge material's atlas (or the placeholder) and how far its icons have faded in */
function inkBadges(material: ShaderMaterial, atlas: BadgeAtlas | null, icons: number) {
  material.uniforms.uAtlas.value = atlas?.texture ?? placeholderTexture();
  const grid = material.uniforms.uGrid.value as number[];
  grid[1] = atlas?.rows ?? 1;
  material.uniforms.uIcons.value = atlas ? icons : 0;
}

const badgePoint = new Vector3();
const badgeView = new Vector3();
const badgeScale = new Vector3();
const badgeMatrix = new Matrix4();
const orbitMatrix = new Matrix4();
const facing = new Quaternion();

/**
 * How visible a badge should be where it is on screen (`ndc`, -1..1): faded
 * right down while it sits behind the page's heading block
 * (worldStore.copy), so the constellation never draws through the copy
 */
function clearOfCopy(ndc: Vector3) {
  const copy = worldStore.copy;
  if (copy.right <= copy.left) return 1;
  const margin = 0.06;
  const dx = Math.max(copy.left - margin - ndc.x, ndc.x - copy.right - margin, 0);
  const dy = Math.max(copy.bottom - margin - ndc.y, ndc.y - copy.top - margin, 0);
  return MathUtils.lerp(0.1, 1, MathUtils.smoothstep(Math.hypot(dx, dy), 0, 0.08));
}

/** Sorts the draw order farthest first (an insertion sort: it is nearly sorted from the last frame) */
function sortBackToFront(order: Int32Array, depth: Float32Array) {
  for (let i = 1; i < order.length; i++) {
    const badge = order[i];
    let j = i - 1;
    while (j >= 0 && depth[order[j]] > depth[badge]) {
      order[j + 1] = order[j];
      j -= 1;
    }
    order[j + 1] = badge;
  }
}

/**
 * Places every badge round its orbit (as its spinner has turned), facing
 * the camera, and writes them into the instanced mesh back to front, as
 * transparent sprites were sorted. The badges respond to the page as well
 * as the pointer: the skill a tile is hovered or focused for
 * (worldStore.skillHover) swells like a hovered badge, and badges outside
 * the category being read (worldStore.skillCategory) dim
 */
function placeBadges(
  mesh: InstancedMesh,
  badges: Badge[],
  state: BadgeState,
  atlas: BadgeAtlas | null,
  spinners: Object3D[],
  named: string,
  camera: Camera,
  dt: number
) {
  const reading = worldStore.skillCategory;
  // The camera's orientation in the mesh's frame: every badge faces it
  mesh.parent?.getWorldQuaternion(facing).invert().multiply(camera.quaternion);
  for (let i = 0; i < badges.length; i++) {
    const badge = badges[i];
    const spinner = spinners[badge.orbit];
    if (!spinner?.parent) continue;
    orbitMatrix.multiplyMatrices(spinner.parent.matrix, spinner.matrix);
    badgePoint
      .set(Math.cos(badge.angle) * badge.radius, 0, Math.sin(badge.angle) * badge.radius)
      .applyMatrix4(orbitMatrix);
    badgePoint.toArray(state.local, i * 3);
    badgeView.copy(badgePoint).applyMatrix4(mesh.matrixWorld);
    badgePoint.copy(badgeView).applyMatrix4(camera.matrixWorldInverse);
    state.depth[i] = badgePoint.z;
    const pointed = badge.name === named;
    // The hovered badge swells
    state.scale[i] = MathUtils.damp(state.scale[i], badge.size * (pointed ? swell : 1), 10, dt);
    const dim = reading && reading !== badge.category && !pointed ? 0.35 : 1;
    const clear = clearOfCopy(badgeView.project(camera));
    state.alpha[i] = MathUtils.damp(state.alpha[i], dim * clear, 8, dt);
  }
  sortBackToFront(state.order, state.depth);
  const geometry = mesh.geometry;
  const cells = geometry.getAttribute('aCell') as InstancedBufferAttribute;
  const mono = geometry.getAttribute('aMono') as InstancedBufferAttribute;
  const alpha = geometry.getAttribute('aAlpha') as InstancedBufferAttribute;
  for (let slot = 0; slot < badges.length; slot++) {
    const i = state.order[slot];
    badgePoint.fromArray(state.local, i * 3);
    badgeScale.setScalar(state.scale[i]);
    mesh.setMatrixAt(slot, badgeMatrix.compose(badgePoint, facing, badgeScale));
    cells.setX(slot, i);
    mono.setX(slot, atlas?.mono[i] ?? 1);
    alpha.setX(slot, state.alpha[i]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  cells.needsUpdate = mono.needsUpdate = alpha.needsUpdate = true;
}

/**
 * An orbit's line and constellation: the category being read, or holding
 * the hovered badge, stays bright (its level's arc brighter still) and its
 * constellation (a star polygon through its badges) lights up
 */
function stepOrbit(
  orbitGroup: Object3D,
  lit: number,
  flare: number,
  camera: Camera,
  t: number,
  dt: number
) {
  const [line, spinner] = orbitGroup.children as [Object3D, Object3D];
  const constellation = spinner?.children.find((child) => (child as LineSegments).isLineSegments);
  if (constellation) {
    const material = (constellation as LineSegments).material as LineBasicMaterial;
    const power = Math.min(stationPower.skills.charge.value, 1);
    const target = Math.max(lit * (0.55 + 0.15 * Math.sin(t * 3)), flare) * power;
    material.opacity = MathUtils.damp(material.opacity, target, 6, dt);
    constellation.visible = material.opacity > 0.01;
  }
  const orbitLine = (line as LineSegments).material as ShaderMaterial;
  const { uOpacity, uLit } = orbitLine.uniforms;
  const bright = Math.max(lit, flare);
  uOpacity.value = MathUtils.damp(uOpacity.value, orbitLine.userData.base * (1 + bright), 6, dt);
  uLit.value = MathUtils.damp(uLit.value, bright, 6, dt);
  orbitGroup.getWorldQuaternion(orbitTurn).invert();
  viewDown.set(0, -1, 0).applyQuaternion(camera.quaternion).applyQuaternion(orbitTurn);
  centreArc(orbitLine, viewDown, dt);
}

/**
 * The station's own clock and each orbit's turn, accumulated frame by
 * frame rather than read off the clock, so an orbit can slow to a stop
 * and pick up again where it was, and nothing jumps at `still`, where the
 * world only draws now and then
 */
interface SpinState {
  ambient: number;
  phases: Float32Array;
  /** Each orbit's speed, 0..1 of its own: it eases to 0 while held */
  rates: Float32Array;
}

function spinFor(ref: { current: SpinState | null }, count: number) {
  if (ref.current?.phases.length !== count) {
    ref.current = {
      ambient: ref.current?.ambient ?? 0,
      phases: Float32Array.from({ length: count }, (_, k) => ref.current?.phases[k] ?? 0),
      rates: new Float32Array(count).fill(1),
    };
  }
  return ref.current;
}

/** Turns orbit `k` on by a frame (unless `held`, or at `still`) and returns its angle */
function turnOrbit(
  spin: SpinState,
  k: number,
  speed: number,
  held: boolean,
  still: boolean,
  dt: number
) {
  spin.rates[k] = MathUtils.damp(spin.rates[k], held ? 0 : 1, 5, dt);
  if (!still) spin.phases[k] += speed * spin.rates[k] * dt;
  return spin.phases[k];
}

/** How bright a showcase's flare of every constellation is, `t` (clock time) after it began */
function flareAt(show: { at: number }, t: number) {
  const since = t - show.at;
  if (since < 0 || since > 3) return 0;
  return since < 0.2 ? since / 0.2 : Math.exp(-(since - 0.2) * 1.4);
}

const planetCentre = new Vector3();
const towardsCamera = new Vector3();

/**
 * Asked to show off (a tour stop landing, or the visitor hailing it): every
 * constellation flares and the planet pings. A tour's showcase waits for
 * full motion; at `still` a hail is the ping alone
 */
function useShowcase(planet: RefObject<Group | null>, show: RefObject<{ at: number }>) {
  const get = useThree((s) => s.get);
  useEffect(
    () =>
      onShowcase((station, reason) => {
        if (station !== 'skills') return;
        const level = motionLevel();
        if (reason === 'tour' && level !== 'full') return;
        const { camera, clock, invalidate } = get();
        const giant = planet.current;
        if (giant) {
          // On the planet's face, towards the camera
          giant.getWorldPosition(planetCentre);
          towardsCamera.subVectors(camera.position, planetCentre).setLength(1.9);
          spawnPing(planetCentre.add(towardsCamera));
        }
        if (level === 'still') {
          repaintFor(invalidate, 1000);
          return;
        }
        show.current.at = clock.elapsedTime;
      }),
    [get, planet, show]
  );
}

/** Builds the badge atlas once the icons are in, and uploads it (once) for the badges to sample */
function useBadgeAtlas(badges: Badge[]) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const track = useWarmupTask();
  const collections = useIconCollections();
  const atlasRef = useRef<BadgeAtlas | null>(null);

  useEffect(() => {
    if (!collections) return;
    let active = true;
    let texture: CanvasTexture | null = null;
    const task = drawAtlas(badges, collections).then(async ({ canvas, rows, mono }) => {
      if (!active) return;
      texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      await queueUpload(gl, texture);
      if (!active) return;
      atlasRef.current = { texture, rows, mono };
      // At `still` the world only draws on demand
      invalidate();
    });
    track(task);
    return () => {
      active = false;
      atlasRef.current = null;
      texture?.dispose();
    };
  }, [badges, collections, gl, invalidate, track]);

  return atlasRef;
}

/** `/skills` — a gas giant with the toolkit orbiting as a constellation of badges */
export function SkillsStation({
  theme,
  skills,
  categories,
}: {
  theme: WorldTheme;
  skills: SkillIcon[];
  categories: string[];
}) {
  const groupRef = useRef<Group>(null);
  const planetRef = useRef<Group>(null);
  const orbitsRef = useRef<Group>(null);
  const outpostRef = useRef<Group>(null);
  const badgesRef = useRef<InstancedMesh>(null);
  /** The badge under the pointer and the instance slot it was hovered in (-1 for none) */
  const hoveredRef = useRef({ badge: -1, slot: -1 });
  const materials = useThemedMaterials(buildMaterials, theme, 'skills');
  const invalidate = useThree((s) => s.invalidate);
  useStillRepaint();

  const orbits = useMemo(
    () =>
      categories.map((category, k) => {
        const members = skills.filter((s) => s.category === category);
        const radius = 3.9 + k * 0.5;
        // Round the orbit in turn, each lifted by its level
        const stars = members.map((skill, i): [number, number] => [
          (i / members.length) * Math.PI * 2 + k,
          radius + levelLift(skill.level),
        ]);
        const level = members.reduce((sum, skill) => sum + skill.level, 0) / (members.length || 1);
        return {
          category,
          members,
          radius,
          stars,
          level: MathUtils.clamp(level / 100, 0, 1),
          geometry: orbitGeometry(radius),
          constellation: constellationGeometry(stars.length ? stars : [[k, radius]]),
          tilt: orbitTilts[k % 4],
        };
      }),
    [categories, skills]
  );

  useEffect(
    () => () =>
      orbits.forEach((orbit) => {
        orbit.geometry.dispose();
        orbit.constellation.dispose();
      }),
    [orbits]
  );

  const badges = useMemo<Badge[]>(
    () =>
      orbits.flatMap((orbit, k) =>
        orbit.members.map((skill, i) => ({
          name: skill.name,
          icon: skill.icon,
          category: skill.category,
          orbit: k,
          angle: orbit.stars[i][0],
          radius: orbit.stars[i][1],
          size: levelScale(skill.level),
        }))
      ),
    [orbits]
  );
  const badgeState = useRef<BadgeState | null>(null);
  const spinRef = useRef<SpinState | null>(null);
  /** When the last showcase began (clock time) */
  const showRef = useRef({ at: -Infinity });
  useShowcase(planetRef, showRef);
  const badgeAttributes = useMemo(() => {
    const attribute = () => {
      const buffer = new InstancedBufferAttribute(new Float32Array(badges.length), 1);
      buffer.setUsage(DynamicDrawUsage);
      return buffer;
    };
    return { cell: attribute(), mono: attribute(), alpha: attribute() };
  }, [badges.length]);
  const atlasRef = useBadgeAtlas(badges);

  // Badges orbit inside this sphere (the raycast's first test; it never needs recomputing)
  useEffect(() => {
    const mesh = badgesRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    const reach = Math.max(...orbits.map((orbit) => orbit.radius), 1) + 1;
    mesh.boundingSphere = new Sphere(new Vector3(), reach);
  }, [orbits, badges.length]);

  const lines = useMemo(() => {
    const dark = theme === 'dark';
    return {
      orbits: orbits.map((orbit) => createOrbitMaterial(theme, orbit.level)),
      constellations: orbits.map(
        () =>
          new LineBasicMaterial({
            color: dark ? '#67e8f9' : '#0e7490',
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: dark ? AdditiveBlending : NormalBlending,
          })
      ),
    };
  }, [orbits, theme]);
  useEffect(
    () => () => {
      lines.orbits.forEach((material) => material.dispose());
      lines.constellations.forEach((material) => material.dispose());
    },
    [lines]
  );

  // One stable tooltip per skill (the tooltip store compares by identity)
  const tips = useMemo(
    () =>
      new Map(
        skills.map((skill) => [
          skill.name,
          {
            label: skill.name,
            sub: `${skill.category[0].toUpperCase()}${skill.category.slice(1)} · click to find it`,
          },
        ])
      ),
    [skills]
  );

  useFrame(({ camera, clock }, delta) => {
    if (!stationInRange(groupRef.current, camera, 'skills')) return;
    // At `still` nothing moves on its own, and what answers the page snaps
    const still = motionLevel() === 'still';
    const dt = still ? 1 : Math.min(delta, 0.05);
    const spin = spinFor(spinRef, orbits.length);
    const t = (spin.ambient += still ? 0 : dt);
    setUniform(materials.planet, 'uTime', t);

    const planet = planetRef.current;
    if (planet) planet.rotation.y = t * 0.06;
    // The research outpost keeps a slow, wide orbit around the giant
    if (outpostRef.current) outpostRef.current.rotation.y = -0.9 + t * 0.045;

    const hovered = hoveredRef.current.badge;
    const named = hovered >= 0 ? badges[hovered].name : worldStore.skillHover;
    const flare = flareAt(showRef.current, clock.elapsedTime);
    const spinners: Object3D[] = [];
    orbitsRef.current?.children.forEach((orbitGroup, k) => {
      const spinner = orbitGroup.children[1];
      if (!spinner || k >= orbits.length) return;
      const namedHere = orbits[k].members.some((skill) => skill.name === named);
      // An orbit holds still while one of its badges is pointed at, so it can be read and clicked
      const speed = (0.05 + k * 0.018) * (k % 2 ? -1 : 1);
      spinner.rotation.y =
        turnOrbit(spin, k, speed, namedHere, still, dt) + worldStore.scroll * 0.8;
      orbitGroup.updateMatrix();
      spinner.updateMatrix();
      spinners[k] = spinner;
      const lit = worldStore.skillCategory === orbits[k].category || namedHere ? 1 : 0;
      stepOrbit(orbitGroup, lit, flare, camera, t, dt);
    });

    const mesh = badgesRef.current;
    const state = badgeStateFor(badgeState, badges.length);
    const atlas = atlasRef.current;
    if (mesh) placeBadges(mesh, badges, state, atlas, spinners, named, camera, dt);
    inkBadges(materials.badges, atlas, fadeIcons(state, atlas, dt));
  });

  const badgeAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId === undefined
      ? -1
      : (badgeStateFor(badgeState, badges.length).order[e.instanceId] ?? -1);

  return (
    <StationScope station="skills">
      <group ref={groupRef} position={stationPositions.skills}>
        <group ref={planetRef} rotation={[0.3, 0, 0.2]}>
          <mesh material={materials.planet}>
            <sphereGeometry args={[1.9, 96, 64]} />
          </mesh>
          <mesh material={materials.atmosphere} scale={1.12}>
            <sphereGeometry args={[1.9, 64, 32]} />
          </mesh>
          <mesh material={materials.ring} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
            <ringGeometry args={[ringInner, ringOuter, 160, 1]} />
          </mesh>
        </group>

        <group rotation={[0.32, 0, -0.18]}>
          <group ref={outpostRef}>
            <group position={[7.4, 0.6, 0]} rotation={[0, Math.PI / 2.4, 0.1]}>
              <Spin speed={0.2}>
                <StationHull station="skills" height={1.9} theme={theme} />
                <SolarArray position={[0.35, 0, -0.1]} length={2} width={0.6} panels={2} />
                <SolarArray
                  position={[-0.35, 0, -0.1]}
                  rotation={[0, Math.PI, 0]}
                  length={2}
                  width={0.6}
                  panels={2}
                />
                <NavLights lights={outpostLights} size={0.035} />
              </Spin>
            </group>
          </group>
        </group>

        <group ref={orbitsRef}>
          {orbits.map((orbit, k) => (
            <group key={orbit.category} rotation={[orbit.tilt[0], 0, orbit.tilt[1]]}>
              <lineLoop geometry={orbit.geometry} material={lines.orbits[k]} />
              <group>
                <lineSegments
                  geometry={orbit.constellation}
                  material={lines.constellations[k]}
                  visible={false}
                />
              </group>
            </group>
          ))}
          {/* Every badge, in one draw; placed each frame round its orbit, facing the camera */}
          <instancedMesh
            key={badges.length}
            ref={badgesRef}
            args={[undefined, undefined, badges.length]}
            material={materials.badges}
            frustumCulled={false}
            onPointerOver={(e) => {
              e.stopPropagation();
              const badge = badgeAt(e);
              if (badge < 0) return;
              const hovered = hoveredRef.current;
              hovered.slot = e.instanceId ?? -1;
              if (hovered.badge === badge) return;
              if (hovered.badge >= 0) setWorldHover(false);
              hovered.badge = badge;
              setWorldHover(true);
              worldTip.set(tips.get(badges[badge].name) ?? null);
              invalidate();
            }}
            onPointerOut={(e) => {
              // The slot it was hovered in: the draw order may have changed since
              const hovered = hoveredRef.current;
              if (hovered.badge < 0 || e.instanceId !== hovered.slot) return;
              const tip = tips.get(badges[hovered.badge].name);
              hovered.badge = hovered.slot = -1;
              setWorldHover(false);
              if (worldTip.get() === tip) worldTip.set(null);
              invalidate();
            }}
            onClick={(e) => {
              e.stopPropagation();
              const badge = badgeAt(e);
              if (badge < 0) return;
              spawnPing(e.point);
              focusOnPage(`skill:${badges[badge].name}`);
            }}
          >
            <planeGeometry>
              <primitive object={badgeAttributes.cell} attach="attributes-aCell" />
              <primitive object={badgeAttributes.mono} attach="attributes-aMono" />
              <primitive object={badgeAttributes.alpha} attach="attributes-aAlpha" />
            </planeGeometry>
          </instancedMesh>
        </group>
      </group>
    </StationScope>
  );
}
