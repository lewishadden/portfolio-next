'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { ReactNode } from 'react';
import type { BufferGeometry } from 'three';
import type { GroupProps } from './types';

/* ------------------------------------------------------------------
   Hard-surface parts built in code: the thin, crisp pieces that
   image-to-3D models can't produce (solar arrays, trusses, masts,
   habitat rings) plus navigation lights. Materials are physically based
   and shared, so every station's parts compile to the same few programs.
   ------------------------------------------------------------------ */

function cellTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#c9ced8';
    ctx.fillRect(0, 0, size, size);
    const cells = 8;
    const step = size / cells;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const gradient = ctx.createLinearGradient(
          x * step,
          y * step,
          (x + 1) * step,
          (y + 1) * step
        );
        gradient.addColorStop(0, '#1b2366');
        gradient.addColorStop(0.55, '#121844');
        gradient.addColorStop(1, '#22306f');
        ctx.fillStyle = gradient;
        ctx.fillRect(x * step + 2, y * step + 2, step - 4, step - 4);
        // Busbars
        ctx.fillStyle = 'rgba(190, 200, 230, 0.35)';
        ctx.fillRect(x * step + step / 3, y * step + 2, 1, step - 4);
        ctx.fillRect(x * step + (2 * step) / 3, y * step + 2, 1, step - 4);
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

let shared: ReturnType<typeof buildMaterials> | null = null;

function buildMaterials() {
  return {
    panel: new MeshStandardMaterial({ color: '#d8dbe4', metalness: 0.55, roughness: 0.38 }),
    dark: new MeshStandardMaterial({ color: '#262a36', metalness: 0.85, roughness: 0.42 }),
    gold: new MeshStandardMaterial({ color: '#c79a3b', metalness: 1, roughness: 0.32 }),
    cells: new MeshStandardMaterial({
      map: cellTexture(),
      metalness: 0.75,
      roughness: 0.22,
      side: DoubleSide,
    }),
    window: new MeshBasicMaterial({
      color: new Color('#ffd9a0').multiplyScalar(3),
      toneMapped: false,
    }),
  };
}

/** Materials shared by every part (created on first use: they need a canvas) */
export function partMaterials() {
  shared ??= buildMaterials();
  return shared;
}

const matrix = new Matrix4();
const dummy = new Object3D();

/* ---------------------------------- Solar array ---------------------------------- */

/**
 * A wing of solar panels on a central mast, along +X from the origin.
 * `panels` blankets, each `width` wide (Z) and `length / panels` long (X).
 */
export function SolarArray({
  length = 4,
  width = 1.1,
  panels = 4,
  ...props
}: GroupProps & { length?: number; width?: number; panels?: number }) {
  const materials = partMaterials();
  const { blanket, mast, repeat } = useMemo(() => {
    const gap = 0.06;
    const each = (length - gap * (panels + 1)) / panels;
    const parts: BufferGeometry[] = [];
    for (let i = 0; i < panels; i++) {
      const box = new BoxGeometry(each, 0.02, width);
      box.translate(gap + each / 2 + i * (each + gap), 0, 0);
      parts.push(box);
    }
    const blanket = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    const mast = new CylinderGeometry(0.035, 0.035, length + 0.3, 8);
    mast.rotateZ(Math.PI / 2).translate(length / 2, 0, 0);
    return { blanket, mast, repeat: new Vector2(length / width, 1) };
  }, [length, width, panels]);

  // Cells are square whatever the wing's proportions
  const cells = useMemo(() => {
    const material = materials.cells.clone();
    material.map = materials.cells.map!.clone();
    material.map.repeat.copy(repeat);
    material.map.needsUpdate = true;
    return material;
  }, [materials, repeat]);

  return (
    <group {...props}>
      <mesh geometry={blanket} material={cells} castShadow receiveShadow />
      <mesh geometry={mast} material={materials.dark} castShadow />
    </group>
  );
}

/* ------------------------------------ Truss ------------------------------------ */

/** A square lattice truss along +Y, one draw call */
export function Truss({
  length = 4,
  size = 0.32,
  bays,
  ...props
}: GroupProps & { length?: number; size?: number; bays?: number }) {
  const materials = partMaterials();
  const geometry = useMemo(() => {
    const count = bays ?? Math.max(2, Math.round(length / size));
    const bay = length / count;
    const half = size / 2;
    const rod = size * 0.07;
    const parts: BufferGeometry[] = [];
    const corners: [number, number][] = [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ];
    for (const [x, z] of corners) {
      parts.push(new CylinderGeometry(rod, rod, length, 6).translate(x, length / 2, z));
    }
    const diagonal = Math.hypot(bay, size);
    const tilt = Math.atan2(size, bay);
    for (let i = 0; i < count; i++) {
      const y = i * bay + bay / 2;
      // Ring at each bay boundary
      for (let side = 0; side < 4; side++) {
        const ring = new BoxGeometry(size, rod * 1.6, rod * 1.6);
        ring.rotateY((side * Math.PI) / 2);
        const [x, z] = [
          [0, -half],
          [half, 0],
          [0, half],
          [-half, 0],
        ][side];
        parts.push(ring.translate(x, i * bay, z));
        // One diagonal brace per face, alternating
        const brace = new CylinderGeometry(rod * 0.7, rod * 0.7, diagonal, 5);
        brace.rotateZ((i + side) % 2 ? tilt : -tilt);
        brace.rotateY((side * Math.PI) / 2 + Math.PI / 2);
        parts.push(brace.translate(x, y, z));
      }
    }
    const merged = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return merged;
  }, [length, size, bays]);

  return (
    <group {...props}>
      <mesh geometry={geometry} material={materials.dark} castShadow receiveShadow />
    </group>
  );
}

/* ----------------------------------- Antenna ----------------------------------- */

const dishProfile = Array.from({ length: 12 }, (_, i) => {
  const r = (i / 11) * 0.5;
  return new Vector2(r, r * r * 0.9);
});

/** A mast with an optional small dish and a beacon at its tip, along +Y */
export function Antenna({
  height = 1.6,
  dish = 0,
  ...props
}: GroupProps & { height?: number; dish?: number }) {
  const materials = partMaterials();
  const dishGeometry = useMemo(() => new LatheGeometry(dishProfile, 32), []);
  return (
    <group {...props}>
      <mesh material={materials.dark} position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.03, height, 6]} />
      </mesh>
      {dish > 0 && (
        <mesh
          geometry={dishGeometry}
          material={materials.panel}
          position={[0, height * 0.7, 0]}
          rotation={[Math.PI / 2.6, 0, 0]}
          scale={dish}
          castShadow
        />
      )}
    </group>
  );
}

/* --------------------------------- Habitat ring --------------------------------- */

/** A spinning habitat ring on spokes: panelled torus with a band of lit windows */
export function HabitatRing({
  radius = 4,
  tube = 0.32,
  spokes = 4,
  ...props
}: GroupProps & { radius?: number; tube?: number; spokes?: number }) {
  const materials = partMaterials();
  const { ring, band, spoke } = useMemo(() => {
    const ring = new TorusGeometry(radius, tube, 20, 160);
    const band = new TorusGeometry(radius + tube * 0.92, tube * 0.12, 6, 160);
    const spoke = new CylinderGeometry(tube * 0.22, tube * 0.22, radius - tube, 8);
    return { ring, band, spoke };
  }, [radius, tube]);
  return (
    <group {...props}>
      <mesh geometry={ring} material={materials.panel} castShadow receiveShadow />
      <mesh geometry={band} material={materials.window} />
      {Array.from({ length: spokes }, (_, i) => {
        const angle = (i / spokes) * Math.PI * 2;
        return (
          <mesh
            key={i}
            geometry={spoke}
            material={materials.dark}
            position={[(Math.cos(angle) * radius) / 2, (Math.sin(angle) * radius) / 2, 0]}
            rotation={[0, 0, angle - Math.PI / 2]}
            castShadow
          />
        );
      })}
    </group>
  );
}

/* -------------------------------- Navigation lights -------------------------------- */

export interface NavLight {
  position: [number, number, number];
  /** red / green: steady port & starboard; white: strobe; cyan / violet: slow pulse */
  kind: 'red' | 'green' | 'white' | 'cyan' | 'violet';
  /** Phase offset in seconds */
  phase?: number;
}

const lightColours: Record<NavLight['kind'], Color> = {
  red: new Color('#ff3b4e').multiplyScalar(4),
  green: new Color('#3dff8a').multiplyScalar(3.4),
  white: new Color('#ffffff').multiplyScalar(6),
  cyan: new Color('#22d3ee').multiplyScalar(3.2),
  violet: new Color('#a78bfa').multiplyScalar(3.2),
};
const lightColour = new Color();
const lightScale = new Vector3();

function brightness(kind: NavLight['kind'], t: number) {
  if (kind === 'white') return t % 1.6 < 0.08 ? 1 : 0.04;
  if (kind === 'cyan' || kind === 'violet') return 0.55 + 0.45 * Math.sin(t * 2.2);
  return 0.8 + 0.2 * Math.sin(t * 1.3);
}

/** Blinking navigation lights, drawn as one instanced mesh */
export function NavLights({
  lights,
  size = 0.05,
  ...props
}: GroupProps & { lights: NavLight[]; size?: number }) {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new SphereGeometry(1, 10, 8), []);
  const material = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    lights.forEach((light, i) => {
      const level = brightness(light.kind, t + (light.phase ?? i * 0.37));
      dummy.position.fromArray(light.position);
      dummy.scale.copy(lightScale.setScalar(size * (0.6 + level * 0.6)));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, lightColour.copy(lightColours[light.kind]).multiplyScalar(level));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group {...props}>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, lights.length]}
        frustumCulled={false}
        onUpdate={(mesh) => {
          // Seed colours so the instance-colour shader variant exists from the first compile
          lights.forEach((light, i) => {
            mesh.setMatrixAt(i, matrix.makeTranslation(...light.position));
            mesh.setColorAt(i, lightColours[light.kind]);
          });
        }}
      />
    </group>
  );
}

/**
 * Turns a craft slowly about its own vertical axis, or with `sweep`
 * (radians) swings it back and forth like a dish tracking a signal. `speed`
 * is the turn rate in radians per second (the peak rate when sweeping).
 * Still for reduced motion: on-demand frames would make it jump.
 */
export function Spin({
  speed = 0.11,
  sweep = 0,
  phase = 0,
  children,
  ...props
}: GroupProps & { speed?: number; sweep?: number; phase?: number; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const still = useThree((s) => s.frameloop === 'demand');

  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group || still) return;
    const t = clock.elapsedTime;
    group.rotation.y =
      sweep > 0 ? Math.sin(t * (speed / sweep) + phase) * sweep : phase + t * speed;
  });

  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  );
}
