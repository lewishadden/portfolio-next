'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MeshBasicMaterial,
  NormalBlending,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';

import { setUniform } from 'components/World/utils';

import { placeLabel, starLabels } from './starLabels';
import { MapTimeline, spoolUp, warpFragment, warpPalettes, warpVertex } from './warp';

import type { Group, Mesh, Object3D, PerspectiveCamera } from 'three';
import type { StationKey } from 'components/World/routes';
import type { MapTheme } from './warp';

/* ------------------------------------------------------------------
   The navigation menu's star map: the six stations as small glowing
   worlds on a tilted orbit, over the warp starfield. The menu's links
   (NavMenu) sit over the worlds, placed here every frame, so all the
   pointing, tapping and keyboard focus is plain DOM; this only draws.

   Opening it arrives out of a warp: the starfield streaks, the camera
   dollies in and the worlds pop up one by one. The orbit drifts slowly
   while nothing is picked; the picked world swells and lights up, the
   others dim, and the station you're docked at wears a pulsing ring.
   ------------------------------------------------------------------ */

/** The orbit's radius, and where on it the first station sits (radians; π/2 is the front) */
const orbitRadius = 3.2;
const fov = 40;
const tanHalfFov = Math.tan(((fov / 2) * Math.PI) / 180);
/** Drift while nothing is picked (rad/s) */
const drift = 0.05;

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const vec = (hex: string) => new Vector3(...rgb(hex));

/** Each world's colours: its deep side, its lit side and its rim light */
const looks: Record<StationKey, { a: string; b: string; rim: string; accent: string }> = {
  home: { a: '#2e1f7a', b: '#22d3ee', rim: '#a78bfa', accent: '#22d3ee' },
  about: { a: '#4c1d95', b: '#f0abfc', rim: '#e9a8f5', accent: '#d946ef' },
  experience: { a: '#083344', b: '#2dd4bf', rim: '#67e8f9', accent: '#22d3ee' },
  projects: { a: '#2e1065', b: '#a78bfa', rim: '#c4b5fd', accent: '#8b5cf6' },
  skills: { a: '#172554', b: '#93c5fd', rim: '#bfdbfe', accent: '#60a5fa' },
  contact: { a: '#053d30', b: '#34d399', rim: '#6ee7b7', accent: '#34d399' },
  lost: { a: '#292524', b: '#78716c', rim: '#a8a29e', accent: '#a8a29e' },
};

const worldVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  void main() {
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const worldFragment = /* glsl */ `
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uRim;
  uniform float uTime;
  uniform float uSeed;
  uniform float uGlow;
  uniform float uDim;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  void main() {
    // Bands of weather, swirling slowly
    float swirl = sin(vPos.x * 3.0 + uSeed) * 0.6 + sin(vPos.z * 2.3 - uSeed) * 0.4;
    float bands = 0.5 + 0.5 * sin(vPos.y * 8.0 + swirl * 1.6 + uTime * 0.25 + uSeed);
    vec3 base = mix(uA, uB, clamp(0.35 + vPos.y * 0.35 + bands * 0.3, 0.0, 1.0));
    // Lit from above left (in view space, so it holds as the orbit turns)
    vec3 light = normalize(vec3(-0.55, 0.65, 0.55));
    float lit = 0.22 + 0.78 * smoothstep(-0.25, 1.0, dot(vNormal, light));
    float rim = pow(1.0 - clamp(dot(vNormal, vView), 0.0, 1.0), 2.4);
    vec3 col = base * lit + uRim * rim * (0.6 + uGlow * 0.8);
    col *= 1.0 - uDim * 0.6;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const uvVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** A soft round glow, on a plane turned to the camera */
const haloFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    gl_FragColor = vec4(uColor, pow(max(1.0 - d, 0.0), 2.2) * uStrength);
  }
`;

/** Rings of dust for the research outpost's planet */
const ringFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    // RingGeometry's uv runs across the ring: x is the radius from 0 (inner) to 1 (outer)
    float bands = 0.55 + 0.45 * sin(vUv.x * 40.0) * sin(vUv.x * 13.0 + 1.3);
    float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
    gl_FragColor = vec4(uColor, bands * edge * uOpacity);
  }
`;

/** The orbit's dashed outer track, brighter towards the front */
const trackFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    float angle = atan(vLocal.y, vLocal.x);
    float dash = step(0.45, fract(angle * 72.0 / 6.2831853 - uTime * 0.4));
    float front = 0.35 + 0.65 * smoothstep(-1.0, 1.0, -vLocal.y / ${orbitRadius.toFixed(1)});
    gl_FragColor = vec4(uColor, dash * front * uOpacity);
  }
`;

const trackVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const blendFor = (theme: MapTheme) => (theme === 'dark' ? AdditiveBlending : NormalBlending);

/** Materials are changed per frame only through helpers (React Compiler rules) */
function setOpacity(material: MeshBasicMaterial, opacity: number) {
  material.opacity = opacity;
}

function createWorldMaterial(key: StationKey, seed: number) {
  const look = looks[key];
  return new ShaderMaterial({
    uniforms: {
      uA: { value: vec(look.a) },
      uB: { value: vec(look.b) },
      uRim: { value: vec(look.rim) },
      uTime: { value: 0 },
      uSeed: { value: seed },
      uGlow: { value: 0 },
      uDim: { value: 0 },
    },
    vertexShader: worldVertex,
    fragmentShader: worldFragment,
  });
}

function createHaloMaterial(colour: string, theme: MapTheme) {
  return new ShaderMaterial({
    uniforms: { uColor: { value: vec(colour) }, uStrength: { value: 0 } },
    vertexShader: uvVertex,
    fragmentShader: haloFragment,
    transparent: true,
    depthWrite: false,
    blending: blendFor(theme),
  });
}

function createGlowMaterial(colour: string, theme: MapTheme, opacity = 0.7) {
  return new MeshBasicMaterial({
    color: colour,
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
    blending: blendFor(theme),
  });
}

function createRingMaterial(colour: string, theme: MapTheme) {
  return new ShaderMaterial({
    uniforms: { uColor: { value: vec(colour) }, uOpacity: { value: 0.6 } },
    vertexShader: uvVertex,
    fragmentShader: ringFragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: blendFor(theme),
  });
}

function createTrackMaterial(colour: string, theme: MapTheme) {
  return new ShaderMaterial({
    uniforms: { uColor: { value: vec(colour) }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: trackVertex,
    fragmentShader: trackFragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: blendFor(theme),
  });
}

function createWarpMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uRes: { value: new Vector2(1, 1) },
      uTime: { value: 0 },
      uTravel: { value: 0 },
      uWarp: { value: 0 },
      uBg: { value: new Vector3() },
      uViolet: { value: new Vector3() },
      uCyan: { value: new Vector3() },
      uStar: { value: new Vector3() },
      uLight: { value: 0 },
    },
    vertexShader: warpVertex,
    fragmentShader: warpFragment,
    depthTest: false,
    depthWrite: false,
  });
}

function setWarpTheme(material: ShaderMaterial, theme: MapTheme) {
  const palette = warpPalettes[theme];
  setUniform(material, 'uBg', vec(palette.bg));
  setUniform(material, 'uViolet', vec(palette.violet));
  setUniform(material, 'uCyan', vec(palette.cyan));
  setUniform(material, 'uStar', vec(palette.star));
  setUniform(material, 'uLight', palette.light);
}

/** One triangle that covers the screen */
function fullScreenTriangle() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
  );
  return geometry;
}

const easeOutBack = (x: number) => {
  const c = 1.4;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
/** Eases `current` towards `target` at `rate` per second */
const approach = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));
const seconds = () => performance.now() / 1000;

/** What every part of the map reads each frame, handed over through a ref */
interface MapState {
  timeline: MapTimeline;
  still: boolean;
  selected: StationKey | '';
  docked: StationKey | '';
}
type MapRef = React.RefObject<MapState>;

/** The warp starfield behind everything */
function Backdrop({ theme, state }: { theme: MapTheme; state: MapRef }) {
  const gl = useThree((s) => s.gl);
  const material = useMemo(() => createWarpMaterial(), []);
  const geometry = useMemo(() => fullScreenTriangle(), []);
  const clock = useRef({ last: seconds(), travel: 0 });
  const buffer = useMemo(() => new Vector2(), []);

  useEffect(() => setWarpTheme(material, theme), [material, theme]);

  useFrame(() => {
    const now = seconds();
    const time = clock.current;
    const dt = Math.min(now - time.last, 0.05);
    time.last = now;
    const { still, timeline } = state.current;
    const warp = still ? 0 : timeline.warp(now);
    time.travel = (time.travel + dt * (0.05 + warp * 2.2)) % 200;
    setUniform(material, 'uRes', gl.getDrawingBufferSize(buffer.clone()));
    setUniform(material, 'uTime', still ? 0 : now);
    setUniform(material, 'uTravel', time.travel);
    setUniform(material, 'uWarp', warp);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-1} />;
}

/** Each station's hint of what it is, in world radii */
function Accessory({ station, theme }: { station: StationKey; theme: MapTheme }) {
  const spinRef = useRef<Group>(null);
  const look = looks[station];
  const glow = useMemo(() => createGlowMaterial(look.accent, theme), [look.accent, theme]);
  const faint = useMemo(() => createGlowMaterial(look.rim, theme, 0.55), [look.rim, theme]);
  const ring = useMemo(() => createRingMaterial(look.rim, theme), [look.rim, theme]);

  useFrame((_, delta) => {
    const spin = spinRef.current;
    if (spin) spin.rotation.y += Math.min(delta, 0.05) * 0.6;
  });

  switch (station) {
    case 'home':
      // The gateway: a portal ring round the world
      return (
        <group rotation={[0.25, 0, 0.35]}>
          <group ref={spinRef}>
            <mesh material={glow} rotation={[0, 0, 0]}>
              <torusGeometry args={[1.55, 0.05, 10, 96]} />
            </mesh>
          </group>
        </group>
      );
    case 'about':
      // The crew habitat: a spoked wheel
      return (
        <group rotation={[1.2, 0, 0.2]}>
          <group ref={spinRef}>
            <mesh material={glow} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.6, 0.08, 8, 80]} />
            </mesh>
            {[0, 1, 2, 3].map((i) => (
              <mesh
                key={i}
                material={faint}
                position={[Math.cos((i * Math.PI) / 2) * 1.3, 0, Math.sin((i * Math.PI) / 2) * 1.3]}
                rotation={[0, -(i * Math.PI) / 2, Math.PI / 2]}
              >
                <boxGeometry args={[0.05, 0.6, 0.05]} />
              </mesh>
            ))}
          </group>
        </group>
      );
    case 'experience':
      // The tether array: a beam through the world, with its pods
      return (
        <group>
          <mesh material={faint}>
            <cylinderGeometry args={[0.035, 0.035, 4.6, 8]} />
          </mesh>
          {[1.5, 1.95, -1.6].map((y) => (
            <mesh key={y} material={glow} position={[0, y, 0]}>
              <sphereGeometry args={[0.14, 16, 12]} />
            </mesh>
          ))}
        </group>
      );
    case 'projects':
      // The fabrication yard: a helix of little screens
      return (
        <group ref={spinRef}>
          {Array.from({ length: 7 }, (_, i) => {
            const angle = i * 0.95;
            return (
              <mesh
                key={i}
                material={i % 2 ? faint : glow}
                position={[Math.sin(angle) * 1.65, -0.9 + i * 0.3, Math.cos(angle) * 1.65]}
                rotation={[0, angle, 0]}
              >
                <planeGeometry args={[0.5, 0.32]} />
              </mesh>
            );
          })}
        </group>
      );
    case 'skills':
      // The research outpost: a ringed planet
      return (
        <mesh material={ring} rotation={[1.25, 0, 0.3]}>
          <ringGeometry args={[1.4, 2.2, 96, 1]} />
        </mesh>
      );
    case 'contact':
      // The comms array: a mast, and signal rings going out
      return (
        <group>
          <mesh material={faint} position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
          </mesh>
          <mesh material={glow} position={[0, 1.68, 0]}>
            <sphereGeometry args={[0.09, 12, 8]} />
          </mesh>
          <Pulses material={glow} />
        </group>
      );
    default:
      return null;
  }
}

/** Signal rings growing out from the comms array and fading */
function Pulses({ material }: { material: MeshBasicMaterial }) {
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const t = seconds();
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const x = (t * 0.45 + i / 3) % 1;
      mesh.scale.setScalar(1.1 + x * 1.5);
      setOpacity(mesh.material as MeshBasicMaterial, (1 - x) * 0.8);
    });
  });
  // Each ring needs its own fading material
  const materials = useMemo(() => [0, 1, 2].map(() => material.clone()), [material]);
  return (
    <group rotation={[Math.PI / 2 - 0.35, 0, 0]}>
      {materials.map((m, i) => (
        <mesh
          key={i}
          material={m}
          ref={(mesh) => {
            refs.current[i] = mesh;
          }}
        >
          <ringGeometry args={[1, 1.05, 64]} />
        </mesh>
      ))}
    </group>
  );
}

/** A ring pulsing under the station you're docked at */
function DockedRing({ theme }: { theme: MapTheme }) {
  const ref = useRef<Mesh>(null);
  const material = useMemo(() => createGlowMaterial('#34d399', theme, 0.8), [theme]);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const x = (seconds() * 0.6) % 1;
    mesh.scale.setScalar(1.25 + x * 0.9);
    setOpacity(material, (1 - x) * 0.85);
  });
  return (
    <mesh ref={ref} material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <ringGeometry args={[1, 1.08, 64]} />
    </mesh>
  );
}

function World({
  station,
  index,
  angle,
  scale,
  theme,
  docked,
  state,
  register,
}: {
  station: StationKey;
  index: number;
  angle: number;
  scale: number;
  theme: MapTheme;
  docked: boolean;
  state: MapRef;
  register: (station: StationKey, object: Object3D | null) => void;
}) {
  const groupRef = useRef<Group>(null);
  const haloRef = useRef<Mesh>(null);
  const material = useMemo(() => createWorldMaterial(station, index * 1.7), [station, index]);
  const halo = useMemo(() => createHaloMaterial(looks[station].rim, theme), [station, theme]);
  const live = useRef({ glow: 0, dim: 0, size: 1 });

  useFrame(({ camera }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);
    const now = seconds();
    const { timeline, still, selected } = state.current;
    const picked = selected === station;
    const values = live.current;
    const target = {
      glow: picked ? 1 : docked ? 0.45 : 0.15,
      dim: selected && !picked ? 1 : 0,
      size: picked ? 1.3 : 1,
    };
    values.glow = still ? target.glow : approach(values.glow, target.glow, 8, dt);
    values.dim = still ? target.dim : approach(values.dim, target.dim, 8, dt);
    values.size = still ? target.size : approach(values.size, target.size, 10, dt);
    // Popping up one by one as the map arrives, shrinking away as it closes
    const since = timeline.since(now);
    const pop = still
      ? timeline.open
        ? 1
        : 0
      : timeline.open
        ? easeOutBack(clamp01((since - 0.25 - index * 0.07) / 0.55))
        : 1 - clamp01(since / spoolUp);
    group.scale.setScalar(Math.max(pop, 0.0001) * scale * values.size);
    setUniform(material, 'uTime', still ? 0 : now);
    setUniform(material, 'uGlow', values.glow);
    setUniform(material, 'uDim', values.dim);
    setUniform(
      halo,
      'uStrength',
      (0.3 + values.glow * 0.45) * (1 - values.dim * 0.6) * (theme === 'dark' ? 0.85 : 0.5)
    );
    haloRef.current?.quaternion.copy(camera.quaternion);
  });

  return (
    <group
      ref={(object) => {
        groupRef.current = object;
        register(station, object);
      }}
      position={[Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius]}
    >
      <mesh ref={haloRef} material={halo} scale={4.2} renderOrder={1}>
        <planeGeometry />
      </mesh>
      <mesh material={material}>
        <sphereGeometry args={[1, 48, 32]} />
      </mesh>
      <Accessory station={station} theme={theme} />
      {docked && <DockedRing theme={theme} />}
    </group>
  );
}

/** The orbit's tracks: a solid ring, a dashed outer one and a faint inner one */
function Orbit({ theme, state }: { theme: MapTheme; state: MapRef }) {
  const solid = useMemo(() => createGlowMaterial('#8b5cf6', theme, 0.55), [theme]);
  const inner = useMemo(() => createGlowMaterial('#22d3ee', theme, 0.16), [theme]);
  const track = useMemo(() => createTrackMaterial('#a78bfa', theme), [theme]);

  useFrame(() => {
    const now = seconds();
    const { timeline, still } = state.current;
    const since = timeline.since(now);
    const shown = still
      ? Number(timeline.open)
      : timeline.open
        ? clamp01((since - 0.15) / 0.6)
        : 1 - clamp01(since / spoolUp);
    setOpacity(solid, 0.55 * shown);
    setOpacity(inner, 0.16 * shown);
    setUniform(track, 'uOpacity', 0.7 * shown);
    setUniform(track, 'uTime', still ? 0 : now);
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh material={solid}>
        <torusGeometry args={[orbitRadius, 0.014, 6, 256]} />
      </mesh>
      <mesh material={track}>
        <ringGeometry args={[orbitRadius + 0.32, orbitRadius + 0.36, 256, 1]} />
      </mesh>
      <mesh material={inner}>
        <torusGeometry args={[orbitRadius - 0.55, 0.01, 6, 192]} />
      </mesh>
    </group>
  );
}

/** Frames the orbit to the screen, arriving out of the warp, and places the links over the worlds */
function Rig({
  state,
  worlds,
  pointer,
}: {
  state: MapRef;
  worlds: React.RefObject<Map<StationKey, Object3D>>;
  pointer: React.RefObject<{ x: number; y: number }>;
}) {
  const size = useThree((s) => s.size);
  const tmp = useMemo(
    () => ({ centre: new Vector3(), edge: new Vector3(), up: new Vector3() }),
    []
  );
  const parallax = useRef({ x: 0, y: 0 });

  useFrame(({ camera }, delta) => {
    const cam = camera as PerspectiveCamera;
    const dt = Math.min(delta, 0.05);
    const now = seconds();
    const aspect = size.width / Math.max(size.height, 1);
    const portrait = aspect < 0.8;
    const tilt = portrait ? 0.62 : 0.4;
    const fit = orbitRadius + 1;
    const distance = Math.max(
      fit / (tanHalfFov * aspect * 0.9),
      (fit * Math.sin(tilt) + 1.3) / (tanHalfFov * 0.62)
    );
    const { still, timeline } = state.current;
    const arrival = still ? 1 : timeline.arrival(now);
    const d = distance * (1 + (1 - arrival) * 2.4);
    // A little parallax with the pointer
    const lean = parallax.current;
    const aim = pointer.current ?? { x: 0, y: 0 };
    lean.x = still ? 0 : approach(lean.x, aim.x, 3, dt);
    lean.y = still ? 0 : approach(lean.y, aim.y, 3, dt);
    const tilted = tilt + lean.y * 0.05;
    cam.position.set(lean.x * 0.6, d * Math.sin(tilted), d * Math.cos(tilted));
    // Look a little below the centre, so the orbit sits above the panel at the bottom
    cam.lookAt(0, portrait ? -0.45 : -0.6, 0);
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();

    // The links follow their worlds
    const { centre, edge, up } = tmp;
    up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    worlds.current?.forEach((object, station) => {
      const el = starLabels.get(station);
      if (!el) return;
      object.updateWorldMatrix(true, false);
      object.getWorldPosition(centre);
      const near = clamp01((centre.z / orbitRadius + 1) / 2);
      edge.copy(centre).addScaledVector(up, object.scale.x);
      centre.project(cam);
      edge.project(cam);
      const x = (centre.x * 0.5 + 0.5) * size.width;
      const y = (0.5 - centre.y * 0.5) * size.height;
      const radius = Math.abs(edge.y - centre.y) * 0.5 * size.height;
      placeLabel(el, x, y, radius, near);
    });
  });

  return null;
}

/** The worlds round the orbit, which drifts while nothing is picked */
function Scene({
  keys,
  theme,
  open,
  docked,
  state,
  pointer,
}: {
  keys: StationKey[];
  theme: MapTheme;
  open: boolean;
  docked: StationKey | '';
  state: MapRef;
  pointer: React.RefObject<{ x: number; y: number }>;
}) {
  const orbitRef = useRef<Group>(null);
  const worlds = useRef(new Map<StationKey, Object3D>());
  const size = useThree((s) => s.size);
  const portrait = size.width / Math.max(size.height, 1) < 0.8;
  const scale = portrait ? 0.5 : 0.42;
  // Evenly round the orbit, from the front going clockwise (seen from above)
  const step = (Math.PI * 2) / Math.max(keys.length, 1);
  const angleOf = (i: number) => Math.PI / 2 + i * step;
  const dockedIndex = docked ? keys.indexOf(docked) : -1;
  // The docked station at the front each time the map opens: the orbit's turn
  // puts a world at angle θ to θ - turn
  const frontTurn = dockedIndex >= 0 ? angleOf(dockedIndex) - Math.PI / 2 : 0;
  const turn = useRef(frontTurn);

  useEffect(() => {
    if (open) turn.current = frontTurn;
  }, [open, frontTurn]);

  const register = useMemo(
    () => (station: StationKey, object: Object3D | null) => {
      if (object) worlds.current.set(station, object);
      else worlds.current.delete(station);
    },
    []
  );

  useFrame((_, delta) => {
    const orbit = orbitRef.current;
    if (!orbit) return;
    const { still, selected } = state.current;
    if (!still && !selected) turn.current += Math.min(delta, 0.05) * drift;
    orbit.rotation.y = turn.current;
  });

  return (
    <>
      <Backdrop theme={theme} state={state} />
      <group ref={orbitRef}>
        <Orbit theme={theme} state={state} />
        {keys.map((station, i) => (
          <World
            key={station}
            station={station}
            index={i}
            angle={angleOf(i)}
            scale={scale}
            theme={theme}
            docked={station === docked}
            state={state}
            register={register}
          />
        ))}
      </group>
      <Rig state={state} worlds={worlds} pointer={pointer} />
    </>
  );
}

/** Drawn on demand (reduced motion): repaint when the menu opens, closes or a pick changes */
function Repaint({ deps }: { deps: unknown[] }) {
  const invalidate = useThree((s) => s.invalidate);
  const key = deps.join('|');
  useEffect(() => {
    invalidate();
  }, [invalidate, key]);
  return null;
}

/**
 * The star map's canvas. Mounted the first time the menu opens with 3D
 * effects on, then kept; it stops drawing once the menu has closed.
 */
export default function StarMap({
  open,
  keys,
  selected,
  docked,
  theme,
  still,
}: {
  open: boolean;
  keys: StationKey[];
  selected: StationKey | '';
  docked: StationKey | '';
  theme: MapTheme;
  /** Reduced motion: no warp, drift or arrival; drawn only when something changes */
  still: boolean;
}) {
  const [timeline] = useState(() => new MapTimeline(open, seconds()));
  const state = useRef<MapState>({ timeline, still, selected, docked });
  const [running, setRunning] = useState(open);
  const pointer = useRef({ x: 0, y: 0 });

  // The frame loop reads these
  useEffect(() => {
    state.current = { timeline, still, selected, docked };
  }, [timeline, still, selected, docked]);

  if (open && !running) setRunning(true);

  useEffect(() => {
    timeline.set(open, seconds());
    if (open) return;
    // Keep drawing while the warp spools up and the menu fades, then stop
    const id = window.setTimeout(() => setRunning(false), spoolUp * 1000 + 80);
    return () => window.clearTimeout(id);
  }, [open, timeline]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  return (
    <Canvas
      className="nav-menu__map"
      flat
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }}
      camera={{ fov, near: 0.1, far: 200, position: [0, 4, 14] }}
      frameloop={still ? 'demand' : running ? 'always' : 'never'}
      // The links on top take every pointer; the canvas only draws
      style={{ pointerEvents: 'none' }}
    >
      <Scene
        keys={keys}
        theme={theme}
        open={open}
        docked={docked}
        state={state}
        pointer={pointer}
      />
      {still && <Repaint deps={[open, selected, docked, theme]} />}
    </Canvas>
  );
}
