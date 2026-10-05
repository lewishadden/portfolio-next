'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';

import { stationPositions } from './stations';
import { seededRandom } from './utils';

import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   An asteroid field: a broad belt below the stations plus a sparse
   scatter far out to the sides. Camera flights arc upwards, so they
   never thread it, but rocks slide past at every depth while flying,
   which is what makes the speed (and the distances) legible. Each rock
   tumbles on its own axis in the vertex shader; the CPU never touches
   the instances after they are placed.
   ------------------------------------------------------------------ */

const spinChunk = /* glsl */ `
  attribute vec4 aSpin;
  uniform float uTime;
  vec3 spin(vec3 v, vec3 axis, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
  }
`;

let rockMaterial: MeshStandardMaterial | null = null;
const time = { value: 0 };

function material() {
  if (rockMaterial) return rockMaterial;
  rockMaterial = new MeshStandardMaterial({
    color: '#9a919f',
    roughness: 0.94,
    metalness: 0.06,
    flatShading: true,
    // Fogged rocks would turn into dark holes over the bright planet
    fog: false,
  });
  rockMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${spinChunk}\nvoid main() {`)
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nobjectNormal = spin(objectNormal, aSpin.xyz, uTime * aSpin.w);'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed = spin(transformed, aSpin.xyz, uTime * aSpin.w);'
      );
  };
  rockMaterial.customProgramCacheKey = () => 'asteroid';
  return rockMaterial;
}

/** A lumpy rock: an icosphere pushed in and out by a few sine lobes */
function rockGeometry(seed: number) {
  const random = seededRandom(seed);
  const geometry = new IcosahedronGeometry(1, 3);
  const position = geometry.getAttribute('position');
  const lobes = Array.from({ length: 5 }, () => ({
    dir: new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
    amount: 0.12 + random() * 0.22,
    sharp: 2 + random() * 4,
  }));
  const v = new Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    let r = 1;
    for (const lobe of lobes)
      r += lobe.amount * (Math.pow(Math.max(v.dot(lobe.dir), 0), lobe.sharp) - 0.25);
    r += (random() - 0.5) * 0.05;
    position.setXYZ(i, v.x * r, v.y * r * 0.82, v.z * r);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const stationPoints = Object.values(stationPositions).map((p) => new Vector3(...p));

function placeRocks(count: number) {
  const random = seededRandom(23);
  const matrices: Matrix4[] = [];
  const spins = new Float32Array(count * 4);
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const axis = new Vector3();
  while (matrices.length < count) {
    const belt = random() < 0.78;
    if (belt) {
      position.set(-150 + random() * 330, -96 + random() * 40, -340 + random() * 420);
    } else {
      const side = random() < 0.5 ? -1 : 1;
      position.set(side * (95 + random() * 90), -40 + random() * 80, -320 + random() * 380);
    }
    if (stationPoints.some((p) => p.distanceTo(position) < 26)) continue;
    const size = Math.pow(random(), 2.6) * 3.2 + 0.18;
    scale.set(size, size * (0.7 + random() * 0.5), size * (0.8 + random() * 0.4));
    quaternion.setFromAxisAngle(
      axis.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
      random() * 6.28
    );
    matrices.push(new Matrix4().compose(position, quaternion, scale));
    const i = matrices.length - 1;
    axis.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
    spins.set([axis.x, axis.y, axis.z, (0.03 + random() * 0.18) / Math.sqrt(size)], i * 4);
  }
  return { matrices, spins };
}

/** Rock shapes, so the field doesn't read as one rock copied */
const variants = 3;

export function Asteroids({ count, theme }: { count: number; theme: WorldTheme }) {
  const meshes = useMemo(() => {
    const { matrices, spins } = placeRocks(count);
    const per = Math.ceil(count / variants);
    return Array.from({ length: variants }, (_, k) => {
      const slice = matrices.slice(k * per, (k + 1) * per);
      const geometry = rockGeometry(101 + k * 7);
      geometry.setAttribute(
        'aSpin',
        new InstancedBufferAttribute(spins.slice(k * per * 4, (k * per + slice.length) * 4), 4)
      );
      const mesh = new InstancedMesh(geometry, material(), slice.length);
      slice.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      // Rocks drift a little but never far: one bound for the whole field
      mesh.computeBoundingSphere();
      return mesh;
    });
  }, [count]);

  useEffect(() => () => meshes.forEach((mesh) => mesh.geometry.dispose()), [meshes]);

  useEffect(() => {
    material().color.set(theme === 'light' ? '#c4bfce' : '#9a919f');
  }, [theme]);

  useFrame(({ clock }) => {
    time.value = clock.elapsedTime;
  });

  return (
    <group>
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  );
}
