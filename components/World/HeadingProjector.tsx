'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  ShaderMaterial,
  Vector3,
} from 'three';

import { motionLevel } from '@/utils/motion';

import { asGlow } from './materials';
import { stationPower } from './power';
import { tierRank } from './quality';
import { contactDish, stationKeys, stationPositions } from './routes';
import { useThemedMaterials } from './stationHooks';
import { setUniform } from './utils';
import { worldMode } from './worldMode';
import { onFlight, worldStore } from './worldStore';

import type { Camera } from 'three';
import type { QualityTier } from './quality';
import type { StationKey } from './routes';
import type { WorldPalette, WorldTheme } from './utils';

/* ------------------------------------------------------------------
   The heading projector: as the camera makes its final approach to a
   page's station, the station throws the page's heading into space. Thin
   beams run from a point on the craft (an antenna tip, a mast, the
   satellite, the dish) to the corners of the heading block on screen, a
   few units in front of the camera, fading from the emitter to the
   heading; from the high tier up a faint cone fills between them. It lasts
   1.4s and follows the station's power-on, so it flickers with its false
   starts. Page flights at full motion only; drawn only while it plays,
   mounted always so it compiles in warm-up. Its materials are built per
   theme only, never per station: rebuilding them on a navigation would
   delete the warmed-up program and link it again on the approach frame.
   ------------------------------------------------------------------ */

/** Seconds the projection lasts */
const duration = 1.4;
/** How far in front of the camera the heading's corners are placed (world units) */
const headingDepth = 7;
/** Alpha at the emitter and at the heading (the outline round it a little brighter) */
const emitterAlpha = 1;
const headingAlpha = 0.15;
const outlineAlpha = 0.25;

/**
 * Where each station's projector sits, from its centre: the hub's antenna
 * tip, the habitat's mast, the satellite, the projects yard's front screen
 * top, the near edge of the skills ring, the comms dish and the wreck
 */
const emitterOffsets: Record<StationKey, readonly [number, number, number]> = {
  home: [4.83, 9.34, -14.99],
  about: [-3.78, 9.17, -13.65],
  experience: [2.3, 1.6, 0],
  projects: [0, 3.05, 5.4],
  skills: [-3.82, -0.74, -0.23],
  contact: contactDish,
  lost: [-2.9, 2.25, -5.6],
};

/** Projectors that move (the experience satellite), in world space, written by their station */
const liveEmitters: Partial<Record<StationKey, [number, number, number]>> = {};

/** A station whose projector moves reports where it is each frame (world space) */
export function setProjectorEmitter(key: StationKey, x: number, y: number, z: number) {
  const at = (liveEmitters[key] ??= [0, 0, 0]);
  at[0] = x;
  at[1] = y;
  at[2] = z;
}

const vertexShader = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uEnvelope, uOpacity, uLight, uCharge;
  varying float vAlpha;
  void main() {
    float alpha = vAlpha * uEnvelope * uOpacity * min(uCharge, 1.0) * mix(1.0, 1.6, uLight);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor * mix(1.8, 1.0, uLight) * max(uCharge, 1.0), alpha);
  }
`;

function createProjectorMaterial(color: string, opacity: number) {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uEnvelope: { value: 0 },
        uOpacity: { value: opacity },
        uLight: { value: 0 },
        uCharge: { value: 1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
    })
  );
}

const buildMaterials = (p: WorldPalette) => ({
  beams: createProjectorMaterial(p.cyan, 0.9),
  cone: createProjectorMaterial(p.cyan, 0.12),
});

/** Beams emitter -> each corner, then the heading's outline: 8 segments */
const beamVertices = 16;
/** The cone: a triangle from the emitter to each edge of the heading */
const coneVertices = 12;

function createGeometry(vertices: number, alphas: number[]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute('aAlpha', new BufferAttribute(Float32Array.from(alphas), 1));
  return geometry;
}

const beamAlphas = [
  ...Array.from({ length: 4 }, () => [emitterAlpha, headingAlpha]).flat(),
  ...Array.from({ length: 8 }, () => outlineAlpha),
];
const coneAlphas = Array.from({ length: 4 }, () => [
  emitterAlpha,
  headingAlpha,
  headingAlpha,
]).flat();

/** The projection under way: the station it comes from and when it started (clock time) */
interface Projection {
  station: StationKey | null;
  /** Set by the flight event, stamped with the clock on the next frame */
  pending: boolean;
  startAt: number;
  /** Whether the cone fills in (the high tier and above) */
  cone: boolean;
}

const createProjection = (): Projection => ({
  station: null,
  pending: false,
  startAt: 0,
  cone: false,
});

const emitter = new Vector3();
const corners = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
const ray = new Vector3();
const forward = new Vector3();

/** The heading block's corners (worldStore.copy, -1..1 on screen) placed `headingDepth` in front of the camera */
function placeCorners(camera: Camera) {
  const { left, right, top, bottom } = worldStore.copy;
  camera.getWorldDirection(forward);
  const ndc: [number, number][] = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];
  ndc.forEach(([x, y], i) => {
    ray.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
    const along = Math.max(ray.dot(forward), 0.2);
    corners[i].copy(camera.position).addScaledVector(ray, headingDepth / along);
  });
}

function placeEmitter(station: StationKey) {
  const live = liveEmitters[station];
  if (live) {
    emitter.fromArray(live);
    return;
  }
  const [x, y, z] = stationPositions[station];
  const [dx, dy, dz] = emitterOffsets[station];
  emitter.set(x + dx, y + dy, z + dz);
}

function writeBeams(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < 4; i++) {
    const next = corners[(i + 1) % 4];
    position.setXYZ(i * 2, emitter.x, emitter.y, emitter.z);
    position.setXYZ(i * 2 + 1, corners[i].x, corners[i].y, corners[i].z);
    position.setXYZ(8 + i * 2, corners[i].x, corners[i].y, corners[i].z);
    position.setXYZ(9 + i * 2, next.x, next.y, next.z);
  }
  position.needsUpdate = true;
}

function writeCone(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < 4; i++) {
    const next = corners[(i + 1) % 4];
    position.setXYZ(i * 3, emitter.x, emitter.y, emitter.z);
    position.setXYZ(i * 3 + 1, corners[i].x, corners[i].y, corners[i].z);
    position.setXYZ(i * 3 + 2, next.x, next.y, next.z);
  }
  position.needsUpdate = true;
}

/** Strength over the projection, `s` seconds in: up in 0.15s, held, faded out by the end */
function envelope(s: number) {
  if (s < 0 || s >= duration) return 0;
  const rise = Math.min(1, s / 0.15);
  const fall = 1 - Math.max(0, (s - (duration - 0.5)) / 0.5);
  return rise * fall * fall;
}

/** Starts a projection on a page flight's final approach (full motion, a heading on screen) */
function project(state: Projection, event: string, to: string) {
  if (event !== 'approach' || !stationKeys.includes(to as StationKey)) return;
  if (worldMode.get().mode !== 'page' || motionLevel() !== 'full') return;
  const { left, right, top, bottom } = worldStore.copy;
  if (right - left < 0.01 || top - bottom < 0.01) return;
  state.station = to as StationKey;
  state.pending = true;
  const tier = document.documentElement.dataset.worldTier as QualityTier | undefined;
  state.cone = tier !== undefined && tierRank(tier) >= tierRank('high');
}

/** The station projects the page heading into space as the camera arrives */
export function HeadingProjector({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const coneRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme);
  const projection = useRef(createProjection());
  const beams = useMemo(() => createGeometry(beamVertices, beamAlphas), []);
  const cone = useMemo(() => createGeometry(coneVertices, coneAlphas), []);
  useEffect(
    () => () => {
      beams.dispose();
      cone.dispose();
    },
    [beams, cone]
  );
  useEffect(() => onFlight((event, to) => project(projection.current, event, to)), []);

  useFrame(({ camera, clock }) => {
    const group = groupRef.current;
    const state = projection.current;
    if (!group) return;
    if (state.pending) {
      state.pending = false;
      state.startAt = clock.elapsedTime;
    }
    // Done with once over, or once R3F restarts its clock (the start then
    // lies ahead of it): kept, it would play again when the clock caught up
    const s = clock.elapsedTime - state.startAt;
    if (s < 0 || s >= duration) state.station = null;
    const strength = state.station ? envelope(s) : 0;
    group.visible = strength > 0;
    if (!group.visible || !state.station) return;
    placeEmitter(state.station);
    placeCorners(camera);
    writeBeams(beams);
    // It flickers with the power-on of the station it comes from
    const charge = stationPower[state.station].charge.value;
    setUniform(materials.beams, 'uEnvelope', strength);
    setUniform(materials.beams, 'uCharge', charge);
    if (coneRef.current) coneRef.current.visible = state.cone;
    if (state.cone) {
      writeCone(cone);
      setUniform(materials.cone, 'uEnvelope', strength);
      setUniform(materials.cone, 'uCharge', charge);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <lineSegments geometry={beams} material={materials.beams} frustumCulled={false} />
      <group ref={coneRef}>
        <mesh geometry={cone} material={materials.cone} frustumCulled={false} />
      </group>
    </group>
  );
}
