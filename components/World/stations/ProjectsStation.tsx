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
  TextureLoader,
  Vector2,
} from 'three';

import { createHaloMaterial, createRingMaterial } from '../materials';
import { NavLights, Truss } from '../parts';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { helix, helixScreenY, projectIntro, settleFocus, stationPositions } from '../stations';
import { StationHull } from '../StationHull';
import { palettes, setUniform } from '../utils';
import { navigateTo, setWorldHover, worldStore, worldTip } from '../worldStore';

import type { Texture, WebGLRenderer } from 'three';
import type { NavLight } from '../parts';
import type { WorldContent } from '../types';
import type { WorldPalette, WorldTheme } from '../utils';

/** How much bigger the screen in front is: the camera's framing box (stations.ts) is sized to it */
const focusScale = 1.4;
const hoverScale = 1.1;
/** Width / height of a screen */
const screenAspect = 2.08 / 1.3;
/** Seconds each shot stays up on a live screen, and the crossfade between them */
const holdTime = 4.5;
const fadeTime = 0.9;
/** Screenshot widths: every screen's working copy, and the sharp one for the screen in front */
const shotWidth = 640;
const frontWidth = 1200;
/** How long a screen sits in front, settled, before its sharp copy loads */
const sharpenAfter = 0.3;
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

function createScreenMaterial(edge: string, tint: string, white: number) {
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
      uEdge: { value: new Color(edge) },
      uTint: { value: new Color(tint) },
      uAspect: { value: 1.6 },
      uDim: { value: 0 },
      uFocus: { value: 0 },
      uWhite: { value: white },
    },
    vertexShader: screenVertex,
    fragmentShader: screenFragment,
    transparent: true,
    side: DoubleSide,
    toneMapped: false,
  });
}

/** Optimised (and cached) through the Next.js image endpoint */
const optimisedImage = (src: string, width: number) =>
  `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;

const loader = new TextureLoader();

/** Loads, decodes off the main thread and uploads a screenshot */
async function loadShot(gl: WebGLRenderer, url: string, width: number) {
  const texture = await loader.loadAsync(optimisedImage(url, width));
  await (texture.image as HTMLImageElement).decode?.().catch(() => undefined);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  gl.initTexture(texture);
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
  /** A sharp copy of the shot that is up, while the screen is in front */
  sharp: Texture | null;
  sharpIndex: number;
  sharpLoading: boolean;
  /** When the screen settled in front of the parked camera (0 while it is not there) */
  settledAt: number;
}

/**
 * Each screen's shots: the first loads up front, the rest the first time the
 * screen goes live. The screen in front also gets a sharp copy of its shot,
 * since it fills half the viewport, dropped again once the camera moves on.
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
    loadShot(this.gl, image.url, shotWidth)
      .then((texture) => {
        state.loading.delete(index);
        if (this.disposed) {
          texture.dispose();
          return;
        }
        state.textures.set(index, texture);
        if (index === state.index) {
          setUniform(this.materials[i], 'uMap', texture);
          setUniform(this.materials[i], 'uHasMap', 1);
        }
      })
      .catch(() => state.loading.delete(index));
  }

  /** Swaps in a sharp copy of the shot that is up, once it has loaded */
  sharpen(i: number) {
    const state = this.states[i];
    const { index } = state;
    const image = this.screens[i].images[index];
    if (!image || state.sharpIndex === index || state.sharpLoading || state.next >= 0) return;
    state.sharpLoading = true;
    loadShot(this.gl, image.url, frontWidth)
      .then((texture) => {
        state.sharpLoading = false;
        if (this.disposed) {
          texture.dispose();
          return;
        }
        state.sharp?.dispose();
        state.sharp = texture;
        state.sharpIndex = index;
        if (state.index === index && state.next < 0) setUniform(this.materials[i], 'uMap', texture);
      })
      .catch(() => {
        state.sharpLoading = false;
      });
  }

  /** Back to the working copy once the screen has left the front */
  soften(i: number) {
    const state = this.states[i];
    const { sharp } = state;
    if (!sharp) return;
    const material = this.materials[i];
    const working = state.textures.get(state.sharpIndex) ?? null;
    if (material.uniforms.uMap.value === sharp) setUniform(material, 'uMap', working);
    if (material.uniforms.uMapB.value === sharp) setUniform(material, 'uMapB', working);
    sharp.dispose();
    state.sharp = null;
    state.sharpIndex = -1;
  }

  dispose() {
    this.disposed = true;
    this.states.forEach((state) => {
      state.textures.forEach((texture) => texture.dispose());
      state.sharp?.dispose();
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
 * loading each the first time it is needed.
 */
function liveScreen(
  material: ShaderMaterial,
  state: ScreenState,
  count: number,
  i: number,
  t: number,
  dt: number,
  live: boolean,
  shots: ScreenShots
) {
  state.hover = approach(state.hover, live ? 1 : 0, 6, dt);
  setUniform(material, 'uHover', state.hover);
  const current = state.textures.get(state.index);
  if (current) scrollWindow(material.uniforms.uWindow.value, windowHeight(current), t, i * 1.7);

  if (state.next >= 0) {
    const incoming = state.textures.get(state.next);
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
  if (t >= state.nextSwitch && state.textures.has(upcoming)) {
    state.next = upcoming;
    state.fadeStart = t;
    setUniform(material, 'uMapB', state.textures.get(upcoming));
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
        sharp: null,
        sharpIndex: -1,
        sharpLoading: false,
        settledAt: 0,
      })),
    [screens]
  );

  const screenMaterials = useMemo(
    () =>
      screens.map((_, i) =>
        createScreenMaterial(
          i % 2 ? palette.cyan : palette.violet,
          i % 2 ? '#0e7490' : '#6d28d9',
          screenWhite[theme]
        )
      ),
    [screens, palette.cyan, palette.violet, theme]
  );

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
    // Settled in front with the camera parked: the moment to sharpen its shot
    const parked =
      live >= 0 && ride > 0.99 && Math.abs(front - live) < 0.02 && !worldStore.flight.active;

    setUniform(materials.base, 'uTime', t);
    screenMaterials.forEach((material, i) => {
      const state = states[i];
      setUniform(material, 'uTime', t + i);
      liveScreen(
        material,
        state,
        screens[i].images.length,
        i,
        t,
        dt,
        i === live || i === hoveredRef.current,
        shots
      );
      if (parked && i === live) {
        if (!state.settledAt) state.settledAt = t;
        if (t - state.settledAt > sharpenAfter) shots.sharpen(i);
      } else {
        state.settledAt = 0;
        if (i !== live) shots.soften(i);
      }
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
                scale={[2.08, 1.3, 1]}
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
