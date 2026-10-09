'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  NormalBlending,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';

import { motionLevel } from '@/utils/motion';

import { asGlow } from './materials';
import { pageCopyShown } from './stations';
import { palettes } from './utils';
import { worldMode } from './worldMode';
import { worldStore } from './worldStore';

import type { Mesh, WebGLRenderer } from 'three';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   The course drawn in space: one ribbon along the path the camera will
   take, facing the camera (the vertex shader turns each pair of vertices
   across the line of sight), so it reads as a line however it is seen.
   Pink while a hovered or focused link previews the course to its
   station (worldStore.previewPath), cyan once the flight is under way
   (worldStore.flight.path) or the free-roam autopilot has a course
   (worldStore.autopilotPath). Dashes march towards the destination and
   the stretch already flown falls away, so the line shortens as the
   camera flies it. It starts a little in front of the camera, fades into
   the station at the far end, and never shows behind the page's heading
   block (worldStore.copy) while that is on screen. Nothing marches below
   full motion (a still line), and at `still` there is none.

   The geometry is allocated once (64 segments) and rewritten only when
   the path changes. Always mounted, drawn in the warm-up so its program
   is compiled before it first shows, then hidden while there is no
   course (no draw call on a settled page).
   ------------------------------------------------------------------ */

const segments = 64;
const vertices = (segments + 1) * 2;
/** World units between the starts of two dashes */
const dashSpacing = 2.5;

const vertexShader = /* glsl */ `
  attribute vec3 aTangent;
  attribute float aSide;
  attribute float aAlong;
  varying float vAlong;
  varying float vDistance;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 toCamera = cameraPosition - world.xyz;
    float distance = length(toCamera);
    // Across the line of sight, so the ribbon faces the camera
    vec3 across = cross(aTangent, toCamera);
    float size = length(across);
    vec3 side = size > 1e-5 ? across / size : vec3(0.0);
    // Thin far off, never thinner than 0.05 units close up
    float width = max(0.05, distance * 0.0018);
    world.xyz += side * aSide * width * 0.5;
    vAlong = aAlong;
    vDistance = distance;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uMarch;
  uniform float uFlown;
  uniform float uLength;
  uniform vec4 uCopy;
  uniform vec2 uResolution;
  varying float vAlong;
  varying float vDistance;
  void main() {
    // Dashes marching towards the destination (uMarch is the distance they have moved)
    float dash = fract((vAlong * uLength - uMarch) / ${dashSpacing.toFixed(1)});
    float alpha = smoothstep(0.0, 0.06, dash) * (1.0 - smoothstep(0.5, 0.56, dash));
    // The stretch already flown falls away; the line starts in front of the
    // camera and fades into the station at the far end
    alpha *= smoothstep(uFlown, uFlown + 0.03, vAlong);
    alpha *= smoothstep(2.5, 9.0, vDistance);
    alpha *= 1.0 - smoothstep(0.93, 1.0, vAlong);
    // Never behind the page's heading block (NDC, y up; all 0 when there is none)
    vec2 ndc = gl_FragCoord.xy / uResolution * 2.0 - 1.0;
    float inCopy = step(uCopy.x, ndc.x) * step(ndc.x, uCopy.y) * step(uCopy.w, ndc.y) * step(ndc.y, uCopy.z);
    alpha *= 1.0 - inCopy * step(0.001, uCopy.y - uCopy.x);
    alpha *= uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

type Source = 'preview' | 'flight' | 'autopilot' | '';

interface LineState {
  /** The path the geometry was last built from (its array, by identity) */
  path: Float32Array | null;
  source: Source;
  length: number;
  /** How far the dashes have marched (world units) */
  march: number;
  /** Shown 0..1, eased */
  shown: number;
  drawn: boolean;
}

const curvePoints: Vector3[] = Array.from({ length: 26 }, () => new Vector3());
const point = new Vector3();
const tangent = new Vector3();
const segment = new Vector3();
const toCamera = new Vector3();
const drawingSize = new Vector2();

/** Which course to draw: a flight under way, the autopilot's in free roam, else a previewed link's */
function currentCourse(): { source: Source; path: Float32Array } {
  const { flight, autopilotPath, preview, previewPath } = worldStore;
  const mode = worldMode.get().mode;
  if (flight.active && mode !== 'explore' && flight.path.length >= 6) {
    return { source: 'flight', path: flight.path };
  }
  if (mode === 'explore' && autopilotPath.length >= 6) {
    return { source: 'autopilot', path: autopilotPath };
  }
  if (mode === 'page' && preview && previewPath.length >= 6) {
    return { source: 'preview', path: previewPath };
  }
  return { source: '', path: previewPath };
}

/** Rewrites the ribbon along a CatmullRom through the path's samples (x, y, z triples) */
function build(geometry: BufferGeometry, path: Float32Array) {
  const count = Math.min(Math.floor(path.length / 3), curvePoints.length);
  const points = curvePoints.slice(0, count).map((p, i) => p.fromArray(path, i * 3));
  const curve = new CatmullRomCurve3(points, false, 'centripetal');
  const positions = geometry.getAttribute('position') as BufferAttribute;
  const tangents = geometry.getAttribute('aTangent') as BufferAttribute;
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, point);
    curve.getTangentAt(u, tangent);
    for (let side = 0; side < 2; side++) {
      positions.setXYZ(i * 2 + side, point.x, point.y, point.z);
      tangents.setXYZ(i * 2 + side, tangent.x, tangent.y, tangent.z);
    }
  }
  positions.needsUpdate = true;
  tangents.needsUpdate = true;
  return curve.getLength();
}

/** Share of the ribbon (0..1 along it) behind the camera: the stretch already flown */
function flown(geometry: BufferGeometry, camera: Vector3) {
  const positions = geometry.getAttribute('position') as BufferAttribute;
  let best = Infinity;
  let along = 0;
  for (let i = 0; i < segments; i++) {
    point.fromBufferAttribute(positions, i * 2);
    segment.fromBufferAttribute(positions, i * 2 + 2).sub(point);
    const lengthSq = segment.lengthSq();
    const t =
      lengthSq > 1e-8
        ? Math.min(1, Math.max(0, toCamera.subVectors(camera, point).dot(segment) / lengthSq))
        : 0;
    const distanceSq = point.addScaledVector(segment, t).distanceToSquared(camera);
    if (distanceSq < best) {
      best = distanceSq;
      along = (i + t) / segments;
    }
  }
  return along;
}

function createGeometry() {
  const geometry = new BufferGeometry();
  const sides = new Float32Array(vertices);
  const along = new Float32Array(vertices);
  for (let i = 0; i <= segments; i++) {
    sides[i * 2] = -1;
    sides[i * 2 + 1] = 1;
    along[i * 2] = along[i * 2 + 1] = i / segments;
  }
  const index: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute('aTangent', new BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute('aSide', new BufferAttribute(sides, 1));
  geometry.setAttribute('aAlong', new BufferAttribute(along, 1));
  geometry.setIndex(index);
  return geometry;
}

function createMaterial() {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color() },
        uOpacity: { value: 0 },
        uMarch: { value: 0 },
        uFlown: { value: 0 },
        uLength: { value: 1 },
        uCopy: { value: [0, 0, 0, 0] },
        uResolution: { value: new Vector2(1, 1) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    })
  );
}

/** The theme's blending (additive glow in the dark, plain in light) */
function paint(material: ShaderMaterial, theme: WorldTheme) {
  material.blending = theme === 'light' ? NormalBlending : AdditiveBlending;
  material.needsUpdate = true;
}

function step(
  mesh: Mesh,
  material: ShaderMaterial,
  line: LineState,
  theme: WorldTheme,
  gl: WebGLRenderer,
  camera: Vector3,
  dt: number
) {
  const geometry = mesh.geometry as BufferGeometry;
  const level = motionLevel();
  const course = level === 'still' ? { source: '' as Source, path: null } : currentCourse();
  if (course.source && (course.path !== line.path || course.source !== line.source)) {
    line.path = course.path;
    line.source = course.source;
    line.length = build(geometry, course.path!);
    line.march = 0;
  }
  line.shown += ((course.source ? 1 : 0) - line.shown) * (1 - Math.exp(-dt * 7));
  if (!course.source && line.shown < 0.002) line.shown = 0;
  // Drawn once in the warm-up (its program compiles then), afterwards only while it shows
  mesh.visible = line.shown > 0 || !line.drawn;
  line.drawn = true;
  if (line.shown <= 0) return;

  const uniforms = material.uniforms;
  const palette = palettes[theme];
  const color = line.source === 'preview' ? palette.pink : palette.cyan;
  (uniforms.uColor.value as Color).set(color).multiplyScalar(theme === 'light' ? 1 : 0.85);
  uniforms.uOpacity.value = line.shown;
  if (level === 'full') line.march += dt * 2.2;
  uniforms.uMarch.value = line.march;
  uniforms.uLength.value = line.length;
  uniforms.uFlown.value = line.source === 'preview' ? 0 : flown(geometry, camera);
  // Kept out of the heading block only while it shows: touring, exploring
  // and flying to a new page, it is measured at opacity 0
  const copy = worldStore.copy;
  const shown = pageCopyShown();
  const rect = uniforms.uCopy.value as number[];
  rect[0] = shown ? copy.left : 0;
  rect[1] = shown ? copy.right : 0;
  rect[2] = shown ? copy.top : 0;
  rect[3] = shown ? copy.bottom : 0;
  (uniforms.uResolution.value as Vector2).copy(gl.getDrawingBufferSize(drawingSize));
}

export function CourseLine({ theme }: { theme: WorldTheme }) {
  const meshRef = useRef<Mesh>(null);
  const line = useRef<LineState>({
    path: null,
    source: '',
    length: 1,
    march: 0,
    shown: 0,
    drawn: false,
  });
  const geometry = useMemo(() => createGeometry(), []);
  const material = useMemo(() => createMaterial(), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  useEffect(() => paint(material, theme), [material, theme]);

  useFrame(({ camera, gl }, delta) => {
    const mesh = meshRef.current;
    if (mesh) step(mesh, material, line.current, theme, gl, camera.position, Math.min(delta, 0.05));
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={12}
    />
  );
}
