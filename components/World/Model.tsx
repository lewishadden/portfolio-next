'use client';

import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Box3, Color, Group, Material, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

import { applyGlowTheme, createFresnelMaterial } from './materials';
import { palettes } from './utils';
import { precompile, uploadTextures, useWarmupTask } from './warmup';

import type { ReactNode } from 'react';
import type { WebGLRenderer } from 'three';
import type { GroupProps } from './types';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Holographic core — shown while a model streams in, and used as
   the permanent stand-in if a model fails to load.
   ------------------------------------------------------------------ */
export function HoloCore({ theme, size = 1.4 }: { theme: WorldTheme; size?: number }) {
  const groupRef = useRef<Group>(null);
  const palette = palettes[theme];

  const shell = useMemo(
    () => createFresnelMaterial({ color: palette.cyan, power: 1.8, intensity: 2.2 }),
    [palette.cyan]
  );

  useEffect(() => applyGlowTheme(shell, theme), [shell, theme]);
  useEffect(() => () => shell.dispose(), [shell]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    group.rotation.y = clock.elapsedTime * 0.35;
    group.rotation.x = Math.sin(clock.elapsedTime * 0.4) * 0.3;
  });

  return (
    <group ref={groupRef}>
      <mesh material={shell}>
        <icosahedronGeometry args={[size, 3]} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[size * 1.02, 1]} />
        <meshBasicMaterial color={palette.violet} wireframe transparent opacity={0.45} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[size * 0.42, 0]} />
        <meshStandardMaterial
          color={palette.violet}
          emissive={palette.violet}
          emissiveIntensity={theme === 'light' ? 0.4 : 1.6}
          metalness={0.4}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------
   Error boundary — a missing or corrupt GLB degrades to the HoloCore
   ------------------------------------------------------------------ */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== 'production') console.warn('[World] model failed to load', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ------------------------------------------------------------------
   Loading: meshopt geometry (decoder bundled) and KTX2 textures, which
   stay compressed on the GPU. The Basis transcoder is self-hosted in
   public/static/basis, so nothing is fetched from a CDN.
   ------------------------------------------------------------------ */
let ktx2Loader: KTX2Loader | null = null;

function configureLoader(gl: WebGLRenderer) {
  return (loader: GLTFLoader) => {
    ktx2Loader ??= new KTX2Loader().setTranscoderPath('/static/basis/').detectSupport(gl);
    loader.setKTX2Loader(ktx2Loader);
    loader.setMeshoptDecoder(MeshoptDecoder);
  };
}

const box = new Box3();
const size = new Vector3();
const center = new Vector3();

/* ------------------------------------------------------------------
   Materialising: a model scans in from the bottom up as it appears. A
   bright line sweeps up through it; below the line it's there, above it
   not yet. Every material of the model shares the reveal's uniforms
   (heights in world space, measured from the model's bounds while it
   plays). Past the top the line is gone and nothing is discarded, so the
   same program serves before, during and after: nothing recompiles.
   ------------------------------------------------------------------ */

/** Seconds a model takes to scan in */
const revealTime = 1.1;

interface Reveal {
  uReveal: { value: number };
  uRevealBottom: { value: number };
  uRevealHeight: { value: number };
  uRevealColor: { value: Color };
}

const createReveal = (): Reveal => ({
  uReveal: { value: 2 },
  uRevealBottom: { value: 0 },
  uRevealHeight: { value: 1 },
  uRevealColor: { value: new Color('#67e8f9').multiplyScalar(3) },
});

function materialise(material: Material, reveal: Reveal) {
  const previous = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    Object.assign(shader.uniforms, reveal);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying float vRevealY;\nvoid main() {')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvRevealY = (modelMatrix * vec4(transformed, 1.0)).y;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform float uReveal;\nuniform float uRevealBottom;\nuniform float uRevealHeight;\nuniform vec3 uRevealColor;\nvarying float vRevealY;\nvoid main() {'
      )
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nfloat revealEdge = (vRevealY - uRevealBottom) / uRevealHeight - uReveal;\nif (revealEdge > 0.0) discard;'
      )
      .replace(
        '#include <opaque_fragment>',
        '#include <opaque_fragment>\ngl_FragColor.rgb += uRevealColor * smoothstep(-0.07, 0.0, revealEdge);'
      );
  };
  material.customProgramCacheKey = () => `${key}+reveal`;
}

/**
 * Clones the scene, centres it on the origin and scales it to `height` world
 * units. Tripo exports face -Z, so the result is turned to face the camera (+Z).
 * Its materials are its own copies (they share programs and textures), so
 * each model scans in on its own.
 */
function normaliseScene(
  scene: Object3D,
  height: number,
  envIntensity: number,
  prepare?: (model: Object3D) => void
) {
  const clone = scene.clone(true);
  box.setFromObject(clone);
  box.getSize(size);
  box.getCenter(center);
  const scale = height / Math.max(size.y, 1e-3);
  clone.position.copy(center).multiplyScalar(-scale);
  clone.scale.setScalar(scale);
  clone.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((m) => m.clone());
    else mesh.material = mesh.material.clone();
    const material = mesh.material as MeshStandardMaterial;
    if (material && 'envMapIntensity' in material) {
      material.envMapIntensity = envIntensity;
      material.needsUpdate = true;
    }
  });
  prepare?.(clone);
  const reveal = createReveal();
  clone.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      materialise(material, reveal);
  });
  const holder = new Group();
  holder.add(clone);
  holder.rotation.y = Math.PI;
  return { holder, reveal };
}

const bounds = new Box3();

/** Sweeps the scan line up through the model, measured as it stands (it may be moving) */
function stepReveal(model: Object3D, reveal: Reveal, progress: number) {
  bounds.setFromObject(model);
  reveal.uRevealBottom.value = bounds.min.y;
  reveal.uRevealHeight.value = Math.max(bounds.max.y - bounds.min.y, 1e-3);
  // From just under the bottom to past the top, easing out
  const eased = 1 - (1 - progress) ** 2;
  reveal.uReveal.value = progress >= 1 ? 2 : -0.08 + eased * 1.2;
}

function GltfModel({
  url,
  height,
  envIntensity,
  placeholder,
  prepare,
}: {
  url: string;
  height: number;
  envIntensity: number;
  /** Shown until the model's shaders are compiled and its textures uploaded */
  placeholder: ReactNode;
  prepare?: (model: Object3D) => void;
}) {
  const gl = useThree((s) => s.gl);
  // No Draco (would fetch a decoder from a CDN)
  const { scene } = useLoader(GLTFLoader, url, configureLoader(gl));
  const { holder: model, reveal } = useMemo(
    () => normaliseScene(scene, height, envIntensity, prepare),
    [scene, height, envIntensity, prepare]
  );
  const scan = useRef({ for: null as Group | null, progress: 0 });
  // On-demand rendering (reduced motion) has no frames to animate with — appear whole
  const scanIn = useThree((s) => s.frameloop !== 'demand');
  const { scene: world, camera } = useThree();
  const track = useWarmupTask();
  const [preparedFor, setPreparedFor] = useState<Group | null>(null);

  // Compile in the background and upload textures a frame at a time, so the
  // model never stalls the frame it first appears in (often mid-flight)
  useEffect(() => {
    let active = true;
    const task = precompile(gl, model, camera, world)
      .then(() => uploadTextures(gl, model))
      .then(() => {
        if (active) setPreparedFor(model);
      });
    track(task);
    return () => {
      active = false;
    };
  }, [gl, world, camera, model, track]);

  // Scan in once it's on show
  useFrame((_, delta) => {
    const state = scan.current;
    if (preparedFor !== model) return;
    if (state.for !== model) {
      state.for = model;
      state.progress = scanIn ? 0 : 1;
    } else if (state.progress >= 1) {
      return;
    } else {
      state.progress = Math.min(1, state.progress + Math.min(delta, 1 / 20) / revealTime);
    }
    stepReveal(model, reveal, state.progress);
  });

  if (preparedFor !== model) return placeholder;

  return <primitive object={model} />;
}

/** Streams a GLB with a holographic placeholder and fallback */
export function Model({
  url,
  height,
  theme,
  envIntensity = 1.1,
  fallbackSize,
  placeholder = true,
  prepare,
  ...props
}: GroupProps & {
  url: string;
  height: number;
  theme: WorldTheme;
  envIntensity?: number;
  fallbackSize?: number;
  /** Show the hologram while loading (false: nothing until the model is ready) */
  placeholder?: boolean;
  /** Adjusts the normalised clone (materials, shadows) before it is compiled; keep it stable */
  prepare?: (model: Object3D) => void;
}) {
  const fallback = placeholder ? (
    <HoloCore theme={theme} size={fallbackSize ?? height * 0.36} />
  ) : null;
  return (
    <group {...props}>
      <ModelBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <GltfModel
            url={url}
            height={height}
            envIntensity={envIntensity}
            placeholder={fallback}
            prepare={prepare}
          />
        </Suspense>
      </ModelBoundary>
    </group>
  );
}
