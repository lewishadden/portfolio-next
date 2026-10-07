'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import {
  Color,
  DoubleSide,
  Group,
  MathUtils,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
} from 'three';

import { decodeImage } from '../imageDecoder';
import { createHaloMaterial, createRingMaterial } from '../materials';
import { NavLights, Truss } from '../parts';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { helix, helixScreenY, projectIntro, settleFocus, stationPositions } from '../stations';
import { StationHull } from '../StationHull';
import { palettes, setUniform } from '../utils';
import { queueUpload } from '../warmup';
import { navigateTo, setWorldHover, worldStore, worldTip } from '../worldStore';

import type { Camera, Object3D, PerspectiveCamera, WebGLRenderer } from 'three';
import type { NavLight } from '../parts';
import type { WorldContent } from '../types';
import type { WorldPalette, WorldTheme } from '../utils';

/** How much bigger the screen in front is: the camera's framing box (stations.ts) is sized to it */
const focusScale = 1.4;
const hoverScale = 1.1;
/** A screen's size in world units, before scaling */
const screenSize = { width: 2.08, height: 1.3 };
const screenAspect = screenSize.width / screenSize.height;
/** Seconds each shot stays up on a live screen, and the crossfade between them */
const holdTime = 4.5;
const fadeTime = 0.9;
/** Width of every screen's working copy of its shots */
const shotWidth = 640;
/**
 * The widths the image endpoint serves (`deviceSizes` in next.config.mjs):
 * a shot is fetched at the next one up and scaled to the size it needs
 */
const imageWidths = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
/** Widest a sharp copy gets: a full-page capture at this width is ~60MB on the GPU */
const maxSharpWidth = 2048;
/** How long a screen sits in front, settled, before its sharp copies load */
const sharpenAfter = 0.3;
/** Longest a crossfade waits for the next shot's sharp copy before using its working copy */
const sharpWait = 3;
/** Where white page content lands, per theme: a lit display that stays under the bloom threshold */
const screenWhite: Record<WorldTheme, number> = { dark: 0.57, light: 0.8 };

const spineLights: NavLight[] = [
  { position: [0, 5.1, 0], kind: 'white' },
  { position: [0, -11, 0], kind: 'white', phase: 0.7 },
  { position: [0.25, 2.1, 0.25], kind: 'cyan' },
  { position: [-0.25, -5, 0.25], kind: 'violet' },
  { position: [0.25, -8, -0.25], kind: 'red' },
];

/** Shortest signed angle from `a` to `b` */
const angleDelta = (a: number, b: number) =>
  MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
/** Frame-rate independent exponential approach */
const approach = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

const screenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const screenFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uMapB;
  uniform float uHasMap;
  uniform float uMix;
  uniform vec2 uWindow;
  uniform vec2 uWindowB;
  uniform float uHover;
  uniform float uTime;
  uniform float uReveal;
  uniform vec3 uEdge;
  uniform vec3 uTint;
  uniform float uAspect;
  uniform float uDim;
  uniform float uFocus;
  uniform float uWhite;
  varying vec2 vUv;
  // A vertical window onto the image: x = its height as a share of the image, y = its top
  vec3 shot(sampler2D map, vec2 window) {
    return texture2D(map, vec2(vUv.x, 1.0 - (window.y + (1.0 - vUv.y) * window.x))).rgb;
  }
  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float d = roundedBox(p, vec2(uAspect, 1.0) * 0.5, 0.06);
    if (d > 0.0) discard;
    vec3 img = uHasMap > 0.5 ? shot(uMap, uWindow) : mix(uTint * 0.25, uTint * 0.6, vUv.y);
    if (uMix > 0.0) img = mix(img, shot(uMapB, uWindowB), uMix);
    // A display, not a lamp: scaled so a white page lands at uWhite, under
    // the bloom threshold, so the content reads and only the edge lighting
    // glows. A gentle curve first deepens mid-tones and text (white stays
    // white), which keeps the dimmed page from looking washed out
    img = pow(img, vec3(1.15)) * uWhite;
    // Scanlines and a passing sweep, faint on the screen in front (uFocus):
    // that one is being read
    float lines = mix(0.08, 0.025, uFocus);
    float scan = 1.0 - lines * (0.5 + 0.5 * sin(vUv.y * 420.0 - uTime * 6.0));
    float sweep = smoothstep(0.0, 0.08, abs(vUv.y - fract(uTime * 0.12)));
    float boost = mix(1.0 + 0.06 * (1.0 - uFocus), 1.0, sweep);
    vec3 col = img * scan * boost * (1.0 + uHover * 0.04);
    float edge = smoothstep(-0.03, 0.0, d);
    col = mix(col, uEdge * (2.4 + uHover * 1.8), edge);
    float reveal = smoothstep(uReveal - 0.1, uReveal, 1.0 - vUv.y);
    // Screens other than the focused project recede
    col *= 1.0 - uDim * 0.75;
    // The screen in front is solid; the rest let a little of the yard through
    gl_FragColor = vec4(col, (1.0 - reveal) * mix(0.96, 1.0, uFocus) * (1.0 - uDim * 0.6));
  }
`;

const buildMaterials = (p: WorldPalette) => ({
  halo: createHaloMaterial({ color: p.cyan, intensity: 1, opacity: 0.45 }),
  haloViolet: createHaloMaterial({ color: p.violet, intensity: 1.2, opacity: 0.5 }),
  base: createRingMaterial({
    colorA: p.cyan,
    colorB: p.violet,
    intensity: 2,
    dashes: 80,
    speed: 0.03,
  }),
});

/** A screen's material; `themeScreen` gives it its edge light and white level */
function createScreenMaterial(tint: string) {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: null },
      uMapB: { value: null },
      uHasMap: { value: 0 },
      uMix: { value: 0 },
      uWindow: { value: new Vector2(1, 0) },
      uWindowB: { value: new Vector2(1, 0) },
      uHover: { value: 0 },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uEdge: { value: new Color() },
      uTint: { value: new Color(tint) },
      uAspect: { value: 1.6 },
      uDim: { value: 0 },
      uFocus: { value: 0 },
      uWhite: { value: screenWhite.dark },
    },
    vertexShader: screenVertex,
    fragmentShader: screenFragment,
    transparent: true,
    side: DoubleSide,
    toneMapped: false,
  });
}

/** The parts of a screen that follow the theme: its edge light, and where white page content lands */
function themeScreen(material: ShaderMaterial, edge: string, theme: WorldTheme) {
  setUniform(material, 'uEdge', edge);
  setUniform(material, 'uWhite', screenWhite[theme]);
}

/** Optimised (and cached) through the Next.js image endpoint, at the next width it serves */
function optimisedImage(src: string, width: number) {
  const served = imageWidths.find((w) => w >= width) ?? imageWidths[imageWidths.length - 1];
  return `/_next/image?url=${encodeURIComponent(src)}&w=${served}&q=75`;
}

type Shot = WorldContent['projects'][number]['images'][number];

/**
 * Loads a screenshot `width` pixels wide (or the source's width, if
 * narrower), decoded and scaled off the main thread, and uploads it on a
 * coming frame. It is scaled here as well as by the image endpoint, which
 * can hand back the full-size original instead (up to 3024 × 8206):
 * uploading those blocked the first flight to the station for over a second
 */
async function loadShot(gl: WebGLRenderer, shot: Shot, width: number) {
  const bitmap = await decodeImage(optimisedImage(shot.url, width), {
    imageOrientation: 'flipY',
    premultiplyAlpha: 'none',
    ...(shot.width > width && { resizeWidth: width, resizeQuality: 'high' }),
  });
  const texture = new Texture(bitmap);
  // Flipped as it was decoded
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  await queueUpload(gl, texture);
  return texture;
}

/** Height of the visible window as a share of the image: full-page captures show a slice */
function windowHeight(texture: Texture) {
  const image = texture.image as { width: number; height: number };
  const aspect = image.height / Math.max(image.width, 1);
  return Math.min(1, 1 / screenAspect / aspect);
}

/** Full-page captures scroll down and back up, slowly (~18s a cycle) */
function scrollWindow(window: Vector2, height: number, t: number, phase: number) {
  window.x = height;
  window.y = height < 1 ? (1 - height) * (0.5 - 0.5 * Math.cos(t * 0.35 + phase)) : 0;
}

/** Live state of one screen: which shot is up, which is fading in */
interface ScreenState {
  index: number;
  next: number;
  textures: Map<number, Texture>;
  loading: Set<number>;
  fadeStart: number;
  nextSwitch: number;
  hover: number;
  /**
   * While the screen is in front, sharp copies of the shot that is up and
   * the next one, `sharpWidth` wide (0 when it isn't in front)
   */
  sharp: Map<number, Texture>;
  sharpLoading: Set<number>;
  sharpWidth: number;
  /** When the screen settled in front of the parked camera (0 while it is not there) */
  settledAt: number;
}

const screenPosition = new Vector3();

/**
 * How wide the screen in front is on the canvas, in pixels: its sharp
 * copies are made that wide, so they are neither soft nor bigger than needed
 * (0 if the working copy is already enough)
 */
function sharpWidthFor(screen: Object3D | undefined, camera: Camera, canvasHeight: number) {
  if (!screen) return 0;
  const distance = camera.position.distanceTo(screen.getWorldPosition(screenPosition));
  const fov = MathUtils.degToRad((camera as PerspectiveCamera).fov);
  const visible = 2 * distance * Math.tan(fov / 2);
  const width = ((screenSize.width * focusScale) / visible) * canvasHeight;
  return width > shotWidth ? Math.min(Math.ceil(width), maxSharpWidth) : 0;
}

/**
 * Each screen's shots: the first loads up front, the rest the first time the
 * screen goes live. The screen in front fills half the viewport, so it also
 * gets sharp copies of the shot that is up and the next one (so crossfades
 * stay sharp too), dropped again once the camera moves on.
 */
class ScreenShots {
  private disposed = false;

  constructor(
    private gl: WebGLRenderer,
    private screens: WorldContent['projects'],
    readonly states: ScreenState[],
    private materials: ShaderMaterial[]
  ) {}

  load(i: number, index: number) {
    const state = this.states[i];
    const image = this.screens[i].images[index];
    if (!image || state.textures.has(index) || state.loading.has(index)) return;
    state.loading.add(index);
    loadShot(this.gl, image, shotWidth)
      .then((texture) => {
        state.loading.delete(index);
        if (this.disposed) {
          texture.dispose();
          return;
        }
        state.textures.set(index, texture);
        if (index === state.index && !state.sharp.has(index)) {
          setUniform(this.materials[i], 'uMap', texture);
          setUniform(this.materials[i], 'uHasMap', 1);
        }
      })
      .catch(() => state.loading.delete(index));
  }

  /** The best copy of a shot there is: the sharp one, else the working copy */
  copy(i: number, index: number) {
    const state = this.states[i];
    return state.sharp.get(index) ?? state.textures.get(index);
  }

  /** Whether a shot's sharp copy is in, or it needs none (its source is no wider than the working copy) */
  sharpReady(i: number, index: number) {
    const image = this.screens[i].images[index];
    return this.states[i].sharp.has(index) || !image || image.width <= shotWidth;
  }

  /**
   * In front: sharp copies, `width` wide, of the shots in `wanted` (the one
   * up and the next), each swapped in as it loads; any others are dropped
   */
  sharpen(i: number, width: number, wanted: number[]) {
    const state = this.states[i];
    // Made for a smaller view (the window has grown since): start again
    if (state.sharpWidth && width > state.sharpWidth * 1.15) this.soften(i);
    if (!state.sharpWidth) state.sharpWidth = width;
    for (const [index, texture] of state.sharp) {
      if (!wanted.includes(index)) this.drop(i, index, texture);
    }
    for (const index of wanted) this.loadSharp(i, index);
  }

  private loadSharp(i: number, index: number) {
    const state = this.states[i];
    const width = state.sharpWidth;
    const image = this.screens[i].images[index];
    if (!image || image.width <= shotWidth) return;
    if (state.sharp.has(index) || state.sharpLoading.has(index)) return;
    state.sharpLoading.add(index);
    loadShot(this.gl, image, width)
      .then((texture) => {
        state.sharpLoading.delete(index);
        // Disposed, or the screen has left the front (or been resized) since
        if (this.disposed || state.sharpWidth !== width) {
          texture.dispose();
          return;
        }
        state.sharp.set(index, texture);
        const material = this.materials[i];
        if (state.index === index) {
          setUniform(material, 'uMap', texture);
          setUniform(material, 'uHasMap', 1);
        }
        if (state.next === index) setUniform(material, 'uMapB', texture);
      })
      .catch(() => state.sharpLoading.delete(index));
  }

  /** Drops a sharp copy, putting the working copy back wherever it is showing */
  private drop(i: number, index: number, texture: Texture) {
    const state = this.states[i];
    const material = this.materials[i];
    const working = state.textures.get(index) ?? null;
    if (material.uniforms.uMap.value === texture) setUniform(material, 'uMap', working);
    if (material.uniforms.uMapB.value === texture) setUniform(material, 'uMapB', working);
    texture.dispose();
    state.sharp.delete(index);
  }

  /** Back to the working copies once the screen has left the front */
  soften(i: number) {
    const state = this.states[i];
    state.sharpWidth = 0;
    for (const [index, texture] of state.sharp) this.drop(i, index, texture);
  }

  dispose() {
    this.disposed = true;
    // The states outlive this, so leave nothing disposed in them: a new set of
    // shots for the same screens starts from scratch
    this.states.forEach((state) => {
      state.textures.forEach((texture) => texture.dispose());
      state.sharp.forEach((texture) => texture.dispose());
      state.textures.clear();
      state.loading.clear();
      state.sharp.clear();
      state.sharpLoading.clear();
      state.sharpWidth = 0;
      state.index = 0;
      state.next = -1;
    });
    this.materials.forEach((material) => material.dispose());
  }
}

/** Opens a project: the grid's modal when on /projects, its page from anywhere else */
function openProject(slug: string) {
  const href = `/projects/${slug}`;
  if (document.querySelector('section.projects')) {
    window.history.pushState({ projectModal: true }, '', href);
  } else {
    navigateTo(href);
  }
}

/**
 * Runs one screen: scrolls full-page captures, and while the screen is live
 * (focused or hovered) crossfades through the project's other shots,
 * loading each the first time it is needed. In front (`sharpWidth` > 0) it
 * keeps sharp copies of the shot that is up and the next one, and waits a
 * little for the next one's before fading to it.
 */
function liveScreen(
  material: ShaderMaterial,
  state: ScreenState,
  count: number,
  i: number,
  t: number,
  dt: number,
  live: boolean,
  shots: ScreenShots,
  sharpWidth: number
) {
  state.hover = approach(state.hover, live ? 1 : 0, 6, dt);
  setUniform(material, 'uHover', state.hover);
  if (sharpWidth > 0) {
    shots.sharpen(
      i,
      sharpWidth,
      count > 1 ? [state.index, (state.index + 1) % count] : [state.index]
    );
  }
  const current = shots.copy(i, state.index);
  if (current) scrollWindow(material.uniforms.uWindow.value, windowHeight(current), t, i * 1.7);

  if (state.next >= 0) {
    const incoming = shots.copy(i, state.next);
    if (!incoming) return;
    scrollWindow(material.uniforms.uWindowB.value, windowHeight(incoming), t, i * 1.7);
    const mix = Math.min((t - state.fadeStart) / fadeTime, 1);
    setUniform(material, 'uMix', mix);
    if (mix >= 1) {
      state.index = state.next;
      state.next = -1;
      state.nextSwitch = t + holdTime;
      setUniform(material, 'uMap', incoming);
      (material.uniforms.uWindow.value as Vector2).copy(material.uniforms.uWindowB.value);
      setUniform(material, 'uMix', 0);
    }
    return;
  }

  if (!live || count < 2) {
    state.nextSwitch = Math.max(state.nextSwitch, t + 1.2);
    return;
  }
  const upcoming = (state.index + 1) % count;
  shots.load(i, upcoming);
  const ready =
    state.textures.has(upcoming) &&
    (!sharpWidth || shots.sharpReady(i, upcoming) || t >= state.nextSwitch + sharpWait);
  if (t >= state.nextSwitch && ready) {
    state.next = upcoming;
    state.fadeStart = t;
    setUniform(material, 'uMapB', shots.copy(i, upcoming));
  }
}

/**
 * `/projects`: the fabrication yard, its hub on a truss spine inside a helix
 * of project screens. On the projects page the camera rides the helix
 * (`stationCamera` follows worldStore.projectFocus down the spiral), so the
 * helix holds still and the screen in front enlarges while the rest dim; an
 * open project page or modal (`focus`) does the same for that project.
 * Elsewhere the helix turns slowly.
 */
export function ProjectsStation({
  theme,
  projects,
  focus = -1,
}: {
  theme: WorldTheme;
  projects: WorldContent['projects'];
  focus?: number;
}) {
  // On-demand rendering (reduced motion) snaps instead of easing
  const snap = useThree((s) => s.frameloop === 'demand');
  const gl = useThree((s) => s.gl);
  const groupRef = useRef<Group>(null);
  const helixRef = useRef<Group>(null);
  const hubRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme);
  const palette = palettes[theme];

  const screens = useMemo(() => projects.slice(0, helix.screens), [projects]);

  const hoveredRef = useRef(-1);
  const tips = useMemo(
    () =>
      screens.map((screen) => ({ label: screen.title.trim(), sub: 'Click to open the project' })),
    [screens]
  );
  const states = useMemo<ScreenState[]>(
    () =>
      screens.map(() => ({
        index: 0,
        next: -1,
        textures: new Map(),
        loading: new Set(),
        fadeStart: 0,
        nextSwitch: 0,
        hover: 0,
        sharp: new Map(),
        sharpLoading: new Set(),
        sharpWidth: 0,
        settledAt: 0,
      })),
    [screens]
  );

  // Built once and recoloured on a theme change, so their shots stay loaded
  // (rebuilding them left every screen blank)
  const screenMaterials = useMemo(
    () => screens.map((_, i) => createScreenMaterial(i % 2 ? '#0e7490' : '#6d28d9')),
    [screens]
  );
  useEffect(() => {
    screenMaterials.forEach((material, i) =>
      themeScreen(material, i % 2 ? palette.cyan : palette.violet, theme)
    );
  }, [screenMaterials, palette.cyan, palette.violet, theme]);

  const shots = useMemo(
    () => new ScreenShots(gl, screens, states, screenMaterials),
    [gl, screens, states, screenMaterials]
  );

  useEffect(() => {
    screens.forEach((_, i) => shots.load(i, 0));
    return () => shots.dispose();
  }, [screens, shots]);

  const settled = useRef(false);
  const opened = focus >= 0 && focus < screens.length ? focus : -1;

  useFrame(({ camera, clock }, delta) => {
    const group = groupRef.current;
    if (!stationInRange(group, camera, 'projects')) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const instant = snap || !settled.current;
    settled.current = true;

    // The project in front: an open one, else wherever the page has scrolled to
    const scrolled = worldStore.projectFocus;
    const front =
      opened >= 0
        ? opened
        : scrolled >= 0
          ? Math.min(settleFocus(scrolled), screens.length - 1)
          : -1;
    // At the top of the projects page the camera holds back on the whole
    // yard: the first screen only comes forward (and lights up) on scroll
    const ride = front >= 0 ? 1 - (opened >= 0 ? 0 : projectIntro()) : 0;
    const live = front >= 0 && ride > 0.9 ? Math.round(front) : -1;
    // Settled in front with the camera parked: the moment to sharpen its
    // shots, to the size it is on the canvas
    const parked =
      live >= 0 && ride > 0.99 && Math.abs(front - live) < 0.02 && !worldStore.flight.active;
    const frontWidth = parked
      ? sharpWidthFor(helixRef.current?.children[live], camera, gl.domElement.height)
      : 0;

    setUniform(materials.base, 'uTime', t);
    screenMaterials.forEach((material, i) => {
      const state = states[i];
      setUniform(material, 'uTime', t + i);
      if (parked && i === live) {
        if (!state.settledAt) state.settledAt = t;
      } else {
        state.settledAt = 0;
        if (i !== live) shots.soften(i);
      }
      const sharp = state.settledAt > 0 && t - state.settledAt > sharpenAfter;
      liveScreen(
        material,
        state,
        screens[i].images.length,
        i,
        t,
        dt,
        i === live || i === hoveredRef.current,
        shots,
        sharp ? frontWidth : 0
      );
      const reveal = material.uniforms.uReveal.value as number;
      if (reveal < 1.1) setUniform(material, 'uReveal', snap ? 1.1 : reveal + dt * 0.8);
      const dim = front >= 0 ? MathUtils.smoothstep(Math.abs(i - front), 0.3, 1) * ride : 0;
      const current = material.uniforms.uDim.value as number;
      setUniform(material, 'uDim', instant ? dim : approach(current, dim, 6, dt));
      // The screen in front is being read: solid, with faint scanlines
      const reading = front >= 0 ? Math.max(0, 1 - Math.abs(i - front)) * ride : 0;
      const shown = material.uniforms.uFocus.value as number;
      setUniform(material, 'uFocus', instant ? reading : approach(shown, reading, 6, dt));
    });

    const spiral = helixRef.current;
    if (spiral) {
      // The camera rides the helix (stationCamera), so it holds still while a
      // project is in front; elsewhere it turns slowly with the page. Always
      // the short way round
      const angle = front >= 0 ? 0 : t * 0.035 + worldStore.scroll * 1.2;
      const turnTo = spiral.rotation.y + angleDelta(spiral.rotation.y, angle);
      if (instant) spiral.rotation.y = turnTo;
      else easing.damp(spiral.rotation, 'y', turnTo, 0.35, dt);

      spiral.children.forEach((screen, i) => {
        const near = front >= 0 ? Math.max(0, 1 - Math.abs(i - front)) * ride : 0;
        const scale = Math.max(
          1 + (focusScale - 1) * near,
          i === hoveredRef.current ? hoverScale : 1
        );
        if (instant) screen.scale.setScalar(scale);
        else easing.damp3(screen.scale, scale, 0.25, dt);
        // Screens orbit with the helix but always turn to face the viewer
        screen.lookAt(camera.position);
      });
    }

    const hub = hubRef.current;
    if (hub) hub.rotation.y = 0.4 + t * 0.1 + worldStore.pointerX * 0.2;
  });

  return (
    <group ref={groupRef} position={stationPositions.projects}>
      <mesh material={materials.haloViolet} position={[0, 0.4, -2.5]} scale={9}>
        <planeGeometry />
      </mesh>
      <mesh material={materials.halo} position={[0, -6, -4]} scale={14}>
        <planeGeometry />
      </mesh>

      <mesh material={materials.base} position={[0, -1.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.018, 8, 200]} />
      </mesh>

      <group ref={helixRef}>
        {screens.map((screen, i) => {
          const angle = i * helix.turn;
          return (
            <group
              key={screen.title}
              position={[
                Math.sin(angle) * helix.radius,
                helixScreenY(i),
                Math.cos(angle) * helix.radius,
              ]}
            >
              <mesh
                material={screenMaterials[i]}
                scale={[screenSize.width, screenSize.height, 1]}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  if (hoveredRef.current === i) return;
                  if (hoveredRef.current >= 0) setWorldHover(false);
                  hoveredRef.current = i;
                  setWorldHover(true);
                  worldTip.set(tips[i]);
                }}
                onPointerOut={() => {
                  if (hoveredRef.current !== i) return;
                  hoveredRef.current = -1;
                  setWorldHover(false);
                  if (worldTip.get() === tips[i]) worldTip.set(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  openProject(screen.slug);
                }}
              >
                <planeGeometry />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* The fabrication yard: its hub on a truss spine, the helix of work orbiting it */}
      <Truss position={[0, -11, 0]} length={16} size={0.36} />
      <NavLights lights={spineLights} />
      <group ref={hubRef}>
        <StationHull station="projects" height={2.7} theme={theme} />
      </group>
    </group>
  );
}
