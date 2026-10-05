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
  Vector3,
} from 'three';

import { createHaloMaterial, createRingMaterial } from '../materials';
import { NavLights, Truss } from '../parts';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { framedHeight, isWideViewport, stationFraming, stationPositions } from '../stations';
import { StationHull } from '../StationHull';
import { palettes, setUniform } from '../utils';
import { navigateTo, setWorldHover, worldStore, worldTip } from '../worldStore';

import type { Texture, WebGLRenderer } from 'three';
import type { NavLight } from '../parts';
import type { WorldContent } from '../types';
import type { Framing } from '../stations';
import type { WorldPalette, WorldTheme } from '../utils';

const maxScreens = 15;
const helixRadius = 5.4;
/** Angle and height step between consecutive screens on the helix */
const screenTurn = 0.78;
const screenRise = 1.05;
const screenTop = 2.4;
/** How much bigger the screen in front is, on wide and narrow layouts */
const focusScale = 1.4;
const narrowFocusScale = 1.15;
const hoverScale = 1.1;
/** Width / height of a screen */
const screenAspect = 2.08 / 1.3;
/** Seconds each shot stays up on a live screen, and the crossfade between them */
const holdTime = 4.5;
const fadeTime = 0.9;

const spineLights: NavLight[] = [
  { position: [0, 5.1, 0], kind: 'white' },
  { position: [0, -11, 0], kind: 'white', phase: 0.7 },
  { position: [0.25, 2.1, 0.25], kind: 'cyan' },
  { position: [-0.25, -5, 0.25], kind: 'violet' },
  { position: [0.25, -8, -0.25], kind: 'red' },
];

const toCamera = new Vector3();
const framing: Framing = { zoom: 1, lift: 0 };
const screenY = (i: number) => screenTop - i * screenRise;
/**
 * Scrolling the page turns the helix, but it settles on each project: the
 * middle 60% of the scroll between two projects carries the turn, the rest
 * holds the screen in front still
 */
const settle = (f: number) => {
  const whole = Math.floor(f);
  const x = MathUtils.clamp((f - whole - 0.2) / 0.6, 0, 1);
  return whole + x * x * x * (x * (x * 6 - 15) + 10);
};
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
    // A display, not a lamp: white pages land just under the bloom threshold
    // (0.32), so the content stays readable and only the edge lighting glows
    img = img * 0.5 / (1.0 + img * 0.45);
    float scan = 0.94 + 0.06 * sin(vUv.y * 420.0 - uTime * 6.0);
    float sweep = smoothstep(0.0, 0.08, abs(vUv.y - fract(uTime * 0.12)));
    vec3 col = img * scan * mix(1.15, 1.0, sweep) * (1.0 + uHover * 0.08);
    float edge = smoothstep(-0.03, 0.0, d);
    col = mix(col, uEdge * (2.4 + uHover * 1.8), edge);
    float reveal = smoothstep(uReveal - 0.1, uReveal, 1.0 - vUv.y);
    // Screens other than the focused project recede
    col *= 1.0 - uDim * 0.75;
    gl_FragColor = vec4(col, (1.0 - reveal) * 0.96 * (1.0 - uDim * 0.6));
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

function createScreenMaterial(edge: string, tint: string) {
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
    },
    vertexShader: screenVertex,
    fragmentShader: screenFragment,
    transparent: true,
    side: DoubleSide,
    toneMapped: false,
  });
}

/** Optimised (and cached) through the Next.js image endpoint */
const optimisedImage = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`;

const loader = new TextureLoader();

/** Loads, decodes off the main thread and uploads a screenshot */
async function loadShot(gl: WebGLRenderer, url: string) {
  const texture = await loader.loadAsync(optimisedImage(url));
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
}

/** Each screen's shots: the first loads up front, the rest the first time the screen goes live */
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
    loadShot(this.gl, image.url)
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

  dispose() {
    this.disposed = true;
    this.states.forEach((state) => state.textures.forEach((texture) => texture.dispose()));
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
 * of project screens. On the projects page, scrolling turns and raises the
 * helix to bring each project's screen in front of the camera, enlarged,
 * while the rest dim (worldStore.projectFocus); an open project page or modal
 * (`focus`) does the same for that project. Elsewhere it turns slowly.
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

  const screens = useMemo(() => projects.slice(0, maxScreens), [projects]);

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
      })),
    [screens]
  );

  const screenMaterials = useMemo(
    () =>
      screens.map((_, i) =>
        createScreenMaterial(i % 2 ? palette.cyan : palette.violet, i % 2 ? '#0e7490' : '#6d28d9')
      ),
    [screens, palette.cyan, palette.violet]
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

  useFrame(({ camera, clock, size }, delta) => {
    const group = groupRef.current;
    if (!stationInRange(group, camera, 'projects')) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const instant = snap || !settled.current;
    settled.current = true;

    // The project in front: an open one, else wherever the page has scrolled to
    const scrolled = worldStore.projectFocus;
    const front =
      opened >= 0 ? opened : scrolled >= 0 ? Math.min(settle(scrolled), screens.length - 1) : -1;
    const live = front >= 0 ? Math.round(front) : -1;
    const bigger = isWideViewport(size.width, size.height) ? focusScale : narrowFocusScale;

    setUniform(materials.base, 'uTime', t);
    screenMaterials.forEach((material, i) => {
      setUniform(material, 'uTime', t + i);
      liveScreen(
        material,
        states[i],
        screens[i].images.length,
        i,
        t,
        dt,
        i === live || i === hoveredRef.current,
        shots
      );
      const reveal = material.uniforms.uReveal.value as number;
      if (reveal < 1.1) setUniform(material, 'uReveal', snap ? 1.1 : reveal + dt * 0.8);
      const dim = front >= 0 ? MathUtils.smoothstep(Math.abs(i - front), 0.3, 1) : 0;
      const current = material.uniforms.uDim.value as number;
      setUniform(material, 'uDim', instant ? dim : approach(current, dim, 6, dt));
    });

    const helix = helixRef.current;
    if (helix && group) {
      let angle = t * 0.035 + worldStore.scroll * 1.2;
      let lift = 0;
      if (front >= 0) {
        // Turn the screen onto the line between the camera and the helix axis,
        // and raise it to the height the camera frames the station at. It sits
        // nearer the camera than the axis, so it takes only its share of the
        // narrow-layout drop to line up with the framed point
        toCamera.subVectors(camera.position, group.position);
        angle = Math.atan2(toCamera.x, toCamera.z) - front * screenTurn;
        const { lift: drop } = stationFraming('projects', size.width, size.height, framing);
        const nearer = helixRadius / Math.hypot(toCamera.x, toCamera.z);
        lift =
          framedHeight('projects', toCamera.y, size.width, size.height) -
          drop * nearer -
          screenY(front);
      }
      // Always take the short way round. Scrolling follows closely; opening a
      // project from elsewhere swings round more slowly
      angle = helix.rotation.y + angleDelta(helix.rotation.y, angle);
      const smoothing = opened >= 0 ? 0.5 : 0.22;
      if (instant) {
        helix.rotation.y = angle;
        helix.position.y = lift;
      } else {
        easing.damp(helix.rotation, 'y', angle, smoothing, dt);
        easing.damp(helix.position, 'y', lift, smoothing, dt);
      }

      helix.children.forEach((screen, i) => {
        const near = front >= 0 ? Math.max(0, 1 - Math.abs(i - front)) : 0;
        const scale = Math.max(1 + (bigger - 1) * near, i === hoveredRef.current ? hoverScale : 1);
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
          const angle = i * screenTurn;
          return (
            <group
              key={screen.title}
              position={[Math.sin(angle) * helixRadius, screenY(i), Math.cos(angle) * helixRadius]}
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
