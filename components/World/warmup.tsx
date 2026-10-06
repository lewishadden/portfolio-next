'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useThree } from '@react-three/fiber';
import { Effect, Pass } from 'postprocessing';
import { Group, Mesh, PlaneGeometry, Scene, Texture, WebGLRenderTarget } from 'three';

import type { ReactNode } from 'react';
import type { EffectComposer } from 'postprocessing';
import type { Camera, Material, Object3D, WebGLRenderer } from 'three';
import type { GroupProps } from './types';

/* ------------------------------------------------------------------
   Shader warm-up.

   WebGL compiles a shader the first time something using it is drawn,
   and the main thread waits for it. With many custom shaders that was
   the bulk of the jank when the world loaded and when a station
   appeared mid-flight. Everything here precompiles with
   `renderer.compileAsync` (KHR_parallel_shader_compile: the GPU process
   compiles in the background) before the content is drawn, and uploads
   textures one per frame instead of all on first draw.
   ------------------------------------------------------------------ */

let scratchTarget: WebGLRenderTarget | null = null;

/**
 * Shader variants depend on where they draw: the scene is always drawn into
 * the post-processing input buffer (linear colour, no tone mapping), so it
 * has to be compiled with a render target bound to hit the same programs.
 */
function withTarget<T>(gl: WebGLRenderer, offscreen: boolean, run: () => T): T {
  const previous = gl.getRenderTarget();
  if (offscreen) {
    scratchTarget ??= new WebGLRenderTarget(1, 1);
    gl.setRenderTarget(scratchTarget);
  } else {
    gl.setRenderTarget(null);
  }
  try {
    return run();
  } finally {
    gl.setRenderTarget(previous);
  }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function materialsOf(object: Object3D) {
  const materials = new Set<Material>();
  object.traverse((child) => {
    const material = (child as Mesh).material as Material | Material[] | undefined;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) materials.add(m);
  });
  return materials;
}

type ProgramHandle = { getUniforms: () => unknown; getAttributes: () => unknown };

/**
 * A program's first use also looks up its uniforms and attributes —
 * synchronous queries to the GPU process. Do that here, a frame apart,
 * instead of in the first frame that draws it.
 */
async function primePrograms(gl: WebGLRenderer, materials: Iterable<Material>) {
  const seen = new Set<ProgramHandle>();
  for (const material of materials) {
    const program = (gl.properties.get(material) as { currentProgram?: ProgramHandle })
      .currentProgram;
    if (!program || seen.has(program)) continue;
    seen.add(program);
    const started = performance.now();
    program.getUniforms();
    program.getAttributes();
    // Already-primed programs return instantly; only yield after real work
    if (performance.now() - started > 1) await nextFrame();
  }
}

/** Compiles every material under `object` without blocking; resolves once all are ready */
export async function precompile(
  gl: WebGLRenderer,
  object: Object3D,
  camera: Camera,
  scene: Scene
) {
  await withTarget(gl, true, () => gl.compileAsync(object, camera, scene));
  await primePrograms(gl, materialsOf(object));
}

/** Uploads the textures used under `object` to the GPU, one per frame */
export async function uploadTextures(gl: WebGLRenderer, object: Object3D) {
  const textures = new Set<Texture>();
  for (const material of materialsOf(object))
    for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
  for (const texture of textures) {
    gl.initTexture(texture);
    await nextFrame();
  }
}

let uploads: Promise<unknown> = Promise.resolve();

/**
 * Uploads a texture on a coming frame, one per frame however many are
 * queued, so textures that arrive together don't all land in one frame
 */
export function queueUpload(gl: WebGLRenderer, texture: Texture) {
  const upload = uploads.then(nextFrame).then(() => gl.initTexture(texture));
  uploads = upload.catch(() => undefined);
  return upload;
}

/** Every material a composer's passes (and their effects' internal passes) render with */
function composerMaterials(composer: EffectComposer) {
  const onscreen = new Set<Material>();
  const offscreen = new Set<Material>();
  const visit = (pass: Pass, depth: number) => {
    const target = pass.renderToScreen ? onscreen : offscreen;
    // fullscreenMaterial is a getter; other materials (e.g. the bloom mip chain's) are fields
    if (pass.fullscreenMaterial) target.add(pass.fullscreenMaterial);
    for (const value of Object.values(pass)) {
      if ((value as Material)?.isMaterial) target.add(value as Material);
      else if (depth < 2 && value instanceof Pass) visit(value, depth + 1);
      else if (depth < 2 && value instanceof Effect)
        for (const inner of Object.values(value))
          if (inner instanceof Pass) visit(inner, depth + 1);
    }
    for (const effect of (pass as Pass & { effects?: Effect[] }).effects ?? [])
      for (const inner of Object.values(effect)) if (inner instanceof Pass) visit(inner, depth + 1);
  };
  for (const pass of composer.passes) visit(pass, 0);
  return { onscreen, offscreen };
}

/** Precompiles the post-processing passes (bloom mip chain, effect pass, …) */
export function precompileComposer(gl: WebGLRenderer, composer: EffectComposer, camera: Camera) {
  const { onscreen, offscreen } = composerMaterials(composer);
  // Compile against the passes' own fullscreen triangle: its attributes (no
  // normals) are part of the shader variant, so a plane would miss
  const screen = composer.passes
    .map((pass) => (pass as Pass & { screen?: Mesh | null }).screen)
    .find((mesh): mesh is Mesh => !!mesh?.geometry);
  const geometry = screen?.geometry ?? new PlaneGeometry(2, 2);
  const build = (materials: Set<Material>) => {
    const scene = new Scene();
    for (const material of materials) scene.add(new Mesh(geometry, material));
    return scene;
  };
  const screenScene = build(onscreen);
  const offscreenScene = build(offscreen);
  return Promise.all([
    withTarget(gl, false, () => gl.compileAsync(screenScene, camera)),
    withTarget(gl, true, () => gl.compileAsync(offscreenScene, camera)),
  ])
    .then(() => primePrograms(gl, [...onscreen, ...offscreen]))
    .then(() => {
      if (!screen) geometry.dispose();
    });
}

/* ------------------------------------------------------------------
   Tracking: the canvas stays paused (and hidden) until the first batch
   of warm-up work is done, and the quality governor ignores frame times
   while anything is still warming up.
   ------------------------------------------------------------------ */

/** Counts in-flight warm-up work; a plain store so changes don't re-render the world */
export function createWarmupTracker() {
  let pending = 0;
  let started = 0;
  let queued = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    track(task: Promise<unknown>) {
      pending += 1;
      started += 1;
      notify();
      task
        .catch((error) => {
          if (process.env.NODE_ENV !== 'production') console.warn('[World] warm-up failed', error);
        })
        .finally(() => {
          pending -= 1;
          notify();
        });
    },
    /** Tasks tracked so far, and how many of them have finished (the loading screen's progress) */
    counts: () => ({ started, settled: started - pending }),
    /** The initial scene has been queued — from here, pending === 0 means warm */
    markQueued() {
      queued = true;
      notify();
    },
    idle: () => queued && pending === 0,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type WarmupTracker = ReturnType<typeof createWarmupTracker>;

const WarmupContext = createContext<WarmupTracker | null>(null);

/** Registers a warm-up task (shader compile, texture upload, bake) */
export function useWarmupTask() {
  const tracker = useContext(WarmupContext);
  return tracker?.track ?? noTrack;
}
const noTrack = () => {};

/** True once the initial warm-up is done and nothing is warming up right now */
export function useWarmupIdle() {
  const tracker = useContext(WarmupContext);
  return useSyncExternalStore(
    tracker?.subscribe ?? noSubscribe,
    () => tracker?.idle() ?? true,
    () => false
  );
}
const noSubscribe = () => () => {};

export function WarmupProvider({
  tracker,
  children,
}: {
  tracker: WarmupTracker;
  children: ReactNode;
}) {
  return <WarmupContext.Provider value={tracker}>{children}</WarmupContext.Provider>;
}

/**
 * Renders last inside the canvas: by the time its effect runs every sibling
 * has mounted (and registered its own warm-up), so it precompiles the whole
 * initial scene, then reports (once) when the first batch has finished.
 */
export function WarmupGate({ onWarm }: { onWarm: () => void }) {
  const { gl, scene, camera } = useThree();
  const tracker = useContext(WarmupContext);
  const idle = useWarmupIdle();
  const done = useRef(false);

  useEffect(() => {
    if (!tracker) return;
    tracker.track(precompile(gl, scene, camera, scene));
    tracker.markQueued();
  }, [gl, scene, camera, tracker]);

  useEffect(() => {
    if (!idle || done.current) return;
    done.current = true;
    onWarm();
  }, [idle, onWarm]);

  return null;
}

/**
 * Keeps freshly mounted content (a station visited for the first time)
 * hidden until its shaders are compiled, so it never stalls a frame —
 * typically it is ready well before the camera arrives.
 */
export function Precompiled({ children, ...props }: GroupProps) {
  const { gl, scene, camera } = useThree();
  const track = useWarmupTask();
  const groupRef = useRef<Group>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    let active = true;
    const task = precompile(gl, group, camera, scene).then(() => {
      if (active) setReady(true);
    });
    track(task);
    return () => {
      active = false;
    };
  }, [gl, scene, camera, track]);

  return (
    <group ref={groupRef} visible={ready} {...props}>
      {children}
    </group>
  );
}
