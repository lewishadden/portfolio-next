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
  ShaderChunk,
  Vector3,
} from 'three';

import { skyTime } from './Starfield';
import { stationPositions } from './stations';
import { seededRandom } from './utils';

import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   An asteroid field: a broad belt below the stations plus a sparse
   scatter far out to the sides. Camera flights arc upwards, so they
   never thread it, but rocks slide past at every depth while flying,
   which is what makes the speed (and the distances) legible. Each rock
   tumbles on its own axis in the vertex shader, and the belt turns
   slowly about its centre (the scatter stays put); the CPU never touches
   the instances after they are placed. Rocks are bucketed by size into
   three meshes of increasing detail, one material (one program): small
   rocks don't need the large ones' facets, which roughly halves the
   field's triangles. All of it holds still at the still level (skyTime).
   ------------------------------------------------------------------ */

/** Where the belt lies (the scatter is out to the sides) */
const belt = { x: [-150, 180], y: [-96, -56], z: [-340, 80] } as const;
const beltCentre = new Vector3(
  (belt.x[0] + belt.x[1]) / 2,
  (belt.y[0] + belt.y[1]) / 2,
  (belt.z[0] + belt.z[1]) / 2
);
/** How fast the belt turns about its centre (radians per second): once round in about 26 minutes */
const beltSpin = 0.004;

const spinChunk = /* glsl */ `
  attribute vec4 aSpin;
  attribute float aBelt;
  uniform float uTime;
  uniform mat4 uBelt;
  vec3 spin(vec3 v, vec3 axis, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
  }
`;

/**
 * three's chunks that place an instance (its position, normal and world
 * position), with the belt's turn applied after the rock's own matrix. A
 * group turning the belt instead would have split every bucket in two:
 * twice the draw calls
 */
const turned = (chunk: 'defaultnormal_vertex' | 'project_vertex' | 'worldpos_vertex') =>
  ShaderChunk[chunk].replaceAll('instanceMatrix', 'rockMatrix');

let rockMaterial: MeshStandardMaterial | null = null;
const time = { value: 0 };
const beltTurn = { value: new Matrix4() };

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
    shader.uniforms.uBelt = beltTurn;
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `${spinChunk}\nvoid main() {\n#ifdef USE_INSTANCING\n  mat4 rockMatrix = aBelt > 0.5 ? uBelt * instanceMatrix : instanceMatrix;\n#endif`
      )
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nobjectNormal = spin(objectNormal, aSpin.xyz, uTime * aSpin.w);'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed = spin(transformed, aSpin.xyz, uTime * aSpin.w);'
      )
      .replace('#include <defaultnormal_vertex>', turned('defaultnormal_vertex'))
      .replace('#include <project_vertex>', turned('project_vertex'))
      .replace('#include <worldpos_vertex>', turned('worldpos_vertex'));
  };
  rockMaterial.customProgramCacheKey = () => 'asteroid';
  return rockMaterial;
}

/** A lumpy rock: an icosphere (of the given detail) pushed in and out by a few sine lobes */
function rockGeometry(seed: number, detail: number) {
  const random = seededRandom(seed);
  const geometry = new IcosahedronGeometry(1, detail);
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

/**
 * Rocks under each size (their largest dimension before squashing) take
 * that bucket's icosphere detail: 1, 2, then 3 for the rest. About half
 * the rocks are small enough for detail 1, and the field draws half the
 * triangles it did at detail 3 throughout
 */
const bucketSizes = [0.8, 1.8];
const bucketDetails = [1, 2, 3];

interface Rock {
  matrix: Matrix4;
  spin: [number, number, number, number];
  belt: boolean;
}

const stationPoints = Object.values(stationPositions).map((p) => new Vector3(...p));

function placeRocks(count: number) {
  const random = seededRandom(23);
  const buckets: Rock[][] = bucketDetails.map(() => []);
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const axis = new Vector3();
  let placed = 0;
  while (placed < count) {
    const inBelt = random() < 0.78;
    if (inBelt) {
      position.set(
        belt.x[0] + random() * (belt.x[1] - belt.x[0]),
        belt.y[0] + random() * (belt.y[1] - belt.y[0]),
        belt.z[0] + random() * (belt.z[1] - belt.z[0])
      );
    } else {
      const side = random() < 0.5 ? -1 : 1;
      position.set(side * (95 + random() * 90), -40 + random() * 80, -320 + random() * 380);
    }
    // The belt keeps 40 or more below every station as it turns
    if (stationPoints.some((p) => p.distanceTo(position) < 26)) continue;
    const size = Math.pow(random(), 2.6) * 3.2 + 0.18;
    scale.set(size, size * (0.7 + random() * 0.5), size * (0.8 + random() * 0.4));
    quaternion.setFromAxisAngle(
      axis.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
      random() * 6.28
    );
    const matrix = new Matrix4().compose(position, quaternion, scale);
    axis.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
    const rate = (0.03 + random() * 0.18) / Math.sqrt(size);
    const bucket = bucketSizes.filter((limit) => size >= limit).length;
    buckets[bucket].push({ matrix, spin: [axis.x, axis.y, axis.z, rate], belt: inBelt });
    placed++;
  }
  return buckets;
}

/** One instanced mesh per size bucket */
function rockMesh(rocks: Rock[], k: number) {
  const geometry = rockGeometry(101 + k * 7, bucketDetails[k]);
  geometry.setAttribute(
    'aSpin',
    new InstancedBufferAttribute(new Float32Array(rocks.flatMap((rock) => rock.spin)), 4)
  );
  geometry.setAttribute(
    'aBelt',
    new InstancedBufferAttribute(new Float32Array(rocks.map((rock) => (rock.belt ? 1 : 0))), 1)
  );
  const mesh = new InstancedMesh(geometry, material(), rocks.length);
  rocks.forEach((rock, i) => mesh.setMatrixAt(i, rock.matrix));
  mesh.instanceMatrix.needsUpdate = true;
  // The field is in view from everywhere (and the belt turns, which would
  // leave bounds from where the rocks were placed behind): never culled
  mesh.frustumCulled = false;
  return mesh;
}

const turnAt = new Vector3();

/** The belt's turn about its centre after `t` seconds, as a matrix (CPU side: one per frame) */
function turnBelt(t: number) {
  const matrix = beltTurn.value.makeRotationY(t * beltSpin);
  turnAt.copy(beltCentre).applyMatrix4(matrix);
  matrix.setPosition(beltCentre.x - turnAt.x, beltCentre.y - turnAt.y, beltCentre.z - turnAt.z);
}

export function Asteroids({ count, theme }: { count: number; theme: WorldTheme }) {
  const meshes = useMemo(() => placeRocks(count).map(rockMesh), [count]);

  useEffect(() => () => meshes.forEach((mesh) => mesh.geometry.dispose()), [meshes]);

  useEffect(() => {
    material().color.set(theme === 'light' ? '#c4bfce' : '#9a919f');
  }, [theme]);

  useFrame(({ clock }) => {
    const t = skyTime(clock);
    time.value = t;
    turnBelt(t);
  });

  return (
    <group>
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  );
}
