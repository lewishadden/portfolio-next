'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { easing } from 'maath';
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  MathUtils,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Texture,
  Vector4,
} from 'three';

import { bloomMaskLayer, maskBloom } from '../bloomMask';
import { iconSvg, useIconCollections } from '../icons';
import { decodeImage } from '../imageDecoder';
import { createHaloMaterial, createRingMaterial } from '../materials';
import { NavLights, Truss } from '../parts';
import { spawnPing } from '../Pings';
import { StationScope } from '../power';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import {
  baseFov,
  frontScreenDistance,
  helix,
  helixScreenY,
  projectIntro,
  settleFocus,
  stationPositions,
} from '../stations';
import { StationHull } from '../StationHull';
import { palettes, setUniform } from '../utils';
import { queueUpload } from '../warmup';
import { prefetch } from '../routes';
import { setWorldHover, worldStore, worldTip } from '../worldStore';
import { inspectEntity, inspection, isInspecting } from '../inspection';

import type { BufferGeometry, Mesh, WebGLRenderer } from 'three';
import type { NavLight } from '../parts';
import type { WorldContent } from '../types';
import type { WorldTip } from '../worldStore';
import type { WorldPalette, WorldTheme } from '../utils';

/** How much bigger the screen in front is: the camera's framing box (stations.ts) is sized to it */
const focusScale = 1.4;
const hoverScale = 1.1;
/** A screen's size in world units, before scaling */
const screenSize = { width: 2.08, height: 1.3 };
const screenAspect = screenSize.width / screenSize.height;
/** A screen's corner radius, and the width of the light round its edge, as shares of its height */
const screenCorner = 0.06;
const edgeBand = 0.03;
/** How a shot sits on its screen, as the project gallery shows it (see frameShot) */
type Fit = 'page' | 'logo' | 'whole';
/** Wider than this (width / height) is a logo (isLogo in ProjectBody) */
const logoAspect = 2.2;
/**
 * A logo's plate, as in the project gallery: inset 18% / 24% of the screen,
 * the logo padded inside it by 8% / 6% of the plate's width
 */
const logoPlate = { inset: [0.18, 0.24], padding: [0.08, 0.06] };
/** Seconds each shot stays up on a live screen, and the crossfade between them */
const holdTime = 4.5;
const fadeTime = 0.9;
/** Width of every screen's working copy of its shots */
const shotWidth = 640;
/**
 * The widths the image endpoint serves (`deviceSizes` in next.config.js):
 * a shot is fetched at the next one up and scaled to the size it needs
 */
const imageWidths = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
/** Widest a sharp copy gets: a full-page capture at this width is ~60MB on the GPU */
const maxSharpWidth = 2048;
/** Sharp copies decoded and uploaded at once, nearest the front first */
const maxSharpLoads = 3;
/** Longest a crossfade waits for the next shot's sharp copy before using its working copy */
const sharpWait = 3;

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
  // Where each shot sits on the screen (UV): xy its bottom-left corner, zw its size
  uniform vec4 uRect;
  uniform vec4 uRectB;
  // 1 for a logo, which sits on a white plate
  uniform float uPlate;
  uniform float uPlateB;
  uniform float uHover;
  uniform float uTime;
  uniform float uReveal;
  uniform vec3 uEdge;
  uniform vec3 uTint;
  uniform float uAspect;
  uniform float uDim;
  uniform float uFocus;
  varying vec2 vUv;
  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  // A shot framed the way the project gallery frames it: the shot in its
  // rect (a logo over its white plate), and around it a heavily blurred
  // copy of it, like the gallery's ambient glow
  vec3 shot(sampler2D map, vec4 rect, float plate) {
    vec2 uv = (vUv - rect.xy) / rect.zw;
    vec4 img = texture2D(map, clamp(uv, 0.0, 1.0));
    vec4 haze = texture2D(map, vUv, 6.0);
    vec3 back = mix(vec3(0.03, 0.035, 0.07), haze.rgb, 0.6 * haze.a);
    if (plate > 0.5) {
      vec2 extent = vec2(${(0.5 - logoPlate.inset[0]).toFixed(3)}, ${(0.5 - logoPlate.inset[1]).toFixed(3)});
      float d = roundedBox((vUv - 0.5) * vec2(uAspect, 1.0), extent * vec2(uAspect, 1.0), 0.04);
      back = mix(back, vec3(1.0), 0.94 * step(d, 0.0));
    }
    vec2 inside = step(0.0, uv) * step(uv, vec2(1.0));
    return mix(back, img.rgb, img.a * inside.x * inside.y);
  }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float d = roundedBox(p, vec2(uAspect, 1.0) * 0.5, ${screenCorner});
    if (d > 0.0) discard;
    // Shots show at their own colours and brightness: bloom leaves the
    // screen out inside its edge light (ScreenMask), so a white page reads
    // as a page, not a lamp
    vec3 img = uHasMap > 0.5 ? shot(uMap, uRect, uPlate) : mix(uTint * 0.25, uTint * 0.6, vUv.y);
    if (uMix > 0.0) img = mix(img, shot(uMapB, uRectB, uPlateB), uMix);
    // Scanlines and a passing sweep, faint on the screen in front (uFocus):
    // that one is being read
    float lines = mix(0.08, 0.025, uFocus);
    float scan = 1.0 - lines * (0.5 + 0.5 * sin(vUv.y * 420.0 - uTime * 6.0));
    float sweep = smoothstep(0.0, 0.08, abs(vUv.y - fract(uTime * 0.12)));
    float boost = mix(1.0 + 0.06 * (1.0 - uFocus), 1.0, sweep);
    vec3 col = img * scan * boost * (1.0 + uHover * 0.04);
    float edge = smoothstep(-${edgeBand}, 0.0, d);
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

/** A screen's material; `themeScreen` gives it its edge light */
function createScreenMaterial(tint: string) {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: null },
      uMapB: { value: null },
      uHasMap: { value: 0 },
      uMix: { value: 0 },
      uRect: { value: new Vector4(0, 0, 1, 1) },
      uRectB: { value: new Vector4(0, 0, 1, 1) },
      uPlate: { value: 0 },
      uPlateB: { value: 0 },
      uHover: { value: 0 },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uEdge: { value: new Color() },
      uTint: { value: new Color(tint) },
      uAspect: { value: 1.6 },
      uDim: { value: 0 },
      uFocus: { value: 0 },
    },
    vertexShader: screenVertex,
    fragmentShader: screenFragment,
    transparent: true,
    side: DoubleSide,
    toneMapped: false,
  });
}

/** The part of a screen that follows the theme: its edge light */
function themeScreen(material: ShaderMaterial, edge: string) {
  setUniform(material, 'uEdge', edge);
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
async function loadShot(
  gl: WebGLRenderer,
  shot: Shot,
  width: number,
  /** Holds the upload back until it resolves */
  beforeUpload?: () => Promise<void>
) {
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
  const fit: Fit = shot.tall
    ? 'page'
    : bitmap.width / bitmap.height > logoAspect
      ? 'logo'
      : 'whole';
  texture.userData.fit = fit;
  await beforeUpload?.();
  await queueUpload(gl, texture);
  return texture;
}

/**
 * Resolves on the first frame with no flight under way: sharp copies load
 * mid-flight but wait to upload (uploads mid-flight made the first flight
 * to the station lag)
 */
function landed() {
  return new Promise<void>((resolve) => {
    const check = () => (worldStore.flight.active ? requestAnimationFrame(check) : resolve());
    check();
  });
}

/** The project art's colour pairs (`--art-a` / `--art-b` per tone in ProjectArt.scss) */
const artTones = [
  ['#8b5cf6', '#22d3ee'],
  ['#22d3ee', '#a78bfa'],
  ['#f472b6', '#8b5cf6'],
];

const withAlpha = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/**
 * The screen of a project with no screenshots, drawn like its ProjectArt on
 * the page: the project's icon in a glowing core, tilted dashed orbits and
 * a grid floor over two colour glows. `tone` is the project's number
 */
function drawProjectArt(svg: string | null, tone: number) {
  const width = 1024;
  const height = Math.round(width / screenAspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.userData.fit = 'whole' satisfies Fit;
  const ctx = canvas.getContext('2d');
  if (!ctx) return texture;
  const [a, b] = artTones[tone % artTones.length];
  const glow = (x: number, y: number, radius: number, color: string, alpha: number) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, withAlpha(color, alpha));
    gradient.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };
  ctx.fillStyle = '#0d1024';
  ctx.fillRect(0, 0, width, height);
  glow(width * 0.25, height * 0.15, width * 0.62, a, 0.42);
  glow(width * 0.85, height * 0.95, width * 0.5, b, 0.3);

  // Grid floor, fading in towards the bottom
  const horizon = height * 0.6;
  const floor = ctx.createLinearGradient(0, horizon, 0, height);
  floor.addColorStop(0, withAlpha(b, 0));
  floor.addColorStop(1, withAlpha(b, 0.4));
  ctx.strokeStyle = floor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = width / 2 - 36 * 16; x <= width; x += 36) {
    ctx.moveTo(x, horizon);
    ctx.lineTo(x, height);
  }
  for (let y = horizon; y <= height; y += 36) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // Tilted dashed orbits round the core
  const cx = width / 2;
  const cy = height / 2;
  ctx.setLineDash([10, 9]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = withAlpha(a, 0.7);
  ctx.beginPath();
  ctx.ellipse(cx, cy, height * 0.46, height * 0.15, -0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = withAlpha(b, 0.45);
  ctx.beginPath();
  ctx.ellipse(cx, cy, height * 0.34, height * 0.11, 0.22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // The core: a dark disc in a gradient ring, glowing
  const core = height * 0.17;
  glow(cx, cy, core * 2.4, a, 0.5);
  const ring = ctx.createLinearGradient(cx - core, cy - core, cx + core, cy + core);
  ring.addColorStop(0, a);
  ring.addColorStop(1, b);
  ctx.beginPath();
  ctx.arc(cx, cy, core, 0, Math.PI * 2);
  ctx.fillStyle = '#12142e';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = ring;
  ctx.stroke();

  if (svg) {
    const icon = new Image();
    icon.onload = () => {
      const size = core * 1.05;
      ctx.shadowColor = withAlpha(a, 0.8);
      ctx.shadowBlur = 20;
      ctx.drawImage(icon, cx - size / 2, cy - size / 2, size, size);
      texture.needsUpdate = true;
    };
    icon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  return texture;
}

/**
 * Writes where a shot sits on its screen (`rect`: bottom-left corner and
 * size, in the screen's UV) and returns 1 if it sits on a plate. As in the
 * project gallery: full-page captures fill the width and scroll down and
 * back up (~18s a cycle), logos sit on a white plate, and the rest fit
 * whole, never stretched
 */
function frameShot(rect: Vector4, texture: Texture, t: number, phase: number) {
  const { width, height } = texture.image as { width: number; height: number };
  const aspect = width / Math.max(height, 1);
  const fit = texture.userData.fit as Fit;
  // The share of a full-width image's height the screen shows
  const window = aspect / screenAspect;
  if (fit === 'page' && window < 1) {
    const top = (1 - window) * (0.5 - 0.5 * Math.cos(t * 0.35 + phase));
    rect.set(0, 1 - (1 - top) / window, 1, 1 / window);
    return 0;
  }
  // The box it fits in, in units of the screen's height
  let [x, y, w, h] = [0, 0, screenAspect, 1];
  if (fit === 'logo') {
    const [insetX, insetY] = logoPlate.inset;
    w = screenAspect * (1 - 2 * insetX);
    h = 1 - 2 * insetY;
    const padX = logoPlate.padding[0] * w;
    const padY = logoPlate.padding[1] * w;
    x = screenAspect * insetX + padX;
    y = insetY + padY;
    w -= 2 * padX;
    h -= 2 * padY;
  }
  const fitW = Math.min(w, h * aspect);
  const fitH = fitW / aspect;
  rect.set((x + (w - fitW) / 2) / screenAspect, y + (h - fitH) / 2, fitW / screenAspect, fitH);
  return fit === 'logo' ? 1 : 0;
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
  /** Sharp copies of the shot that is up and, on the screen in front, the next one */
  sharp: Map<number, Texture>;
  sharpLoading: Set<number>;
}

/**
 * How wide a screen is on the canvas, in pixels, once it is in front on the
 * projects page (its sharp copies are made that wide, so they are neither
 * soft nor bigger than needed), or 0 if the working copy is enough. Worked
 * out from the layout rather than measured, so they can load before the
 * camera gets there
 */
function frontScreenWidth(width: number, height: number, canvasHeight: number) {
  const fov = MathUtils.degToRad(baseFov);
  const visible = 2 * frontScreenDistance(width, height) * Math.tan(fov / 2);
  const pixels = ((screenSize.width * focusScale) / visible) * canvasHeight;
  return pixels > shotWidth ? Math.min(Math.ceil(pixels), maxSharpWidth) : 0;
}

/**
 * Each screen's shots: the first loads up front, the rest the first time the
 * screen goes live. On the page, every screen also gets a sharp copy of the
 * shot it shows, and the screen in front one of the next too, loaded ahead
 * of the camera (see sharpen), so a screen is never soft when it is in front.
 */
class ScreenShots {
  private disposed = false;
  /** Width the sharp copies are made at, 0 before the first */
  private sharpWidth = 0;
  /** Sharp copies that failed to load ("screen:shot"), not tried again */
  private failed = new Set<string>();

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

  /** A project with no screenshots shows `art` (its ProjectArt) as its only shot */
  placeholder(i: number, art: Texture) {
    const state = this.states[i];
    if (this.disposed || state.textures.has(0)) {
      art.dispose();
      return;
    }
    state.textures.set(0, art);
    setUniform(this.materials[i], 'uMap', art);
    setUniform(this.materials[i], 'uHasMap', 1);
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

  /** The shots a screen wants sharp: the one up, the one fading in, and in front the next */
  private wantedSharp(i: number, front: number) {
    const state = this.states[i];
    const count = this.screens[i].images.length;
    const wanted = [state.index];
    if (state.next >= 0) wanted.push(state.next);
    else if (i === front && count > 1) wanted.push((state.index + 1) % count);
    return wanted;
  }

  /**
   * Keeps every screen sharp ahead of the camera: sharp copies, `width`
   * wide, of the shots each wants (wantedSharp), loaded a few at a time,
   * nearest the project in `focus` first, and swapped in as they land.
   * Copies of shots a screen has moved on from are dropped
   */
  sharpen(width: number, focus: number, front: number) {
    // Made for a smaller canvas (the window has grown since): start again
    if (this.sharpWidth && width > this.sharpWidth * 1.15) this.soften();
    if (!this.sharpWidth) this.sharpWidth = width;
    let loads = 0;
    this.states.forEach((state, i) => {
      const wanted = this.wantedSharp(i, front);
      for (const [index, texture] of state.sharp) {
        if (!wanted.includes(index)) this.drop(i, index, texture);
      }
      loads += state.sharpLoading.size;
    });
    const order = this.states
      .map((_, i) => i)
      .sort((a, b) => Math.abs(a - focus) - Math.abs(b - focus));
    for (const i of order) {
      for (const index of this.wantedSharp(i, front)) {
        // All of them download now, at low priority, so none waits on the
        // network (or the image endpoint's first resize) when its turn comes
        const image = this.screens[i].images[index];
        if (image && image.width > shotWidth) prefetch(optimisedImage(image.url, this.sharpWidth));
        if (loads < maxSharpLoads && this.loadSharp(i, index)) loads += 1;
      }
    }
  }

  /** Starts loading a shot's sharp copy; false if it has one, is loading it or needs none */
  private loadSharp(i: number, index: number) {
    const state = this.states[i];
    const width = this.sharpWidth;
    const image = this.screens[i].images[index];
    if (!image || image.width <= shotWidth || this.failed.has(`${i}:${index}`)) return false;
    if (state.sharp.has(index) || state.sharpLoading.has(index)) return false;
    state.sharpLoading.add(index);
    loadShot(this.gl, image, width, landed)
      .then((texture) => {
        state.sharpLoading.delete(index);
        // Disposed, or remade at another size since
        if (this.disposed || this.sharpWidth !== width) {
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
      .catch(() => {
        state.sharpLoading.delete(index);
        this.failed.add(`${i}:${index}`);
      });
    return true;
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

  /** Back to the working copies everywhere, to sharpen again at a new size */
  private soften() {
    this.sharpWidth = 0;
    this.states.forEach((state, i) => {
      for (const [index, texture] of state.sharp) this.drop(i, index, texture);
    });
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
      state.index = 0;
      state.next = -1;
    });
    this.materials.forEach((material) => material.dispose());
  }
}

/**
 * Runs one screen: scrolls full-page captures, and while the screen is live
 * (focused or hovered) crossfades through the project's other shots,
 * loading each the first time it is needed. With `waitForSharp` (the screen
 * in front, while sharp copies load) it waits a little for the next shot's
 * sharp copy before fading to it.
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
  waitForSharp: boolean
) {
  state.hover = approach(state.hover, live ? 1 : 0, 6, dt);
  setUniform(material, 'uHover', state.hover);
  const current = shots.copy(i, state.index);
  if (current)
    setUniform(material, 'uPlate', frameShot(material.uniforms.uRect.value, current, t, i * 1.7));

  if (state.next >= 0) {
    const incoming = shots.copy(i, state.next);
    if (!incoming) return;
    setUniform(
      material,
      'uPlateB',
      frameShot(material.uniforms.uRectB.value, incoming, t, i * 1.7)
    );
    const mix = Math.min((t - state.fadeStart) / fadeTime, 1);
    setUniform(material, 'uMix', mix);
    if (mix >= 1) {
      state.index = state.next;
      state.next = -1;
      state.nextSwitch = t + holdTime;
      setUniform(material, 'uMap', incoming);
      (material.uniforms.uRect.value as Vector4).copy(material.uniforms.uRectB.value);
      setUniform(material, 'uPlate', material.uniforms.uPlateB.value);
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
    (!waitForSharp || shots.sharpReady(i, upcoming) || t >= state.nextSwitch + sharpWait);
  if (t >= state.nextSwitch && ready) {
    state.next = upcoming;
    state.fadeStart = t;
    setUniform(material, 'uMapB', shots.copy(i, upcoming));
  }
}

/**
 * The part of a screen kept out of bloom (bloomMask.ts): all of it inside
 * the light round its edge, which still glows. A rounded rectangle in world
 * units, as the screen's mesh is scaled to its size
 */
function screenMaskGeometry() {
  const band = edgeBand * screenSize.height;
  const radius = (screenCorner - edgeBand) * screenSize.height;
  const x = screenSize.width / 2 - band - radius;
  const y = screenSize.height / 2 - band - radius;
  const shape = new Shape();
  shape.absarc(x, y, radius, 0, Math.PI / 2);
  shape.absarc(-x, y, radius, Math.PI / 2, Math.PI);
  shape.absarc(-x, -y, radius, Math.PI, Math.PI * 1.5);
  shape.absarc(x, -y, radius, Math.PI * 1.5, Math.PI * 2);
  return new ShapeGeometry(shape, 4);
}

/** Keeps a screen's page out of bloom, so it shows at its own brightness */
function ScreenMask({ geometry }: { geometry: BufferGeometry }) {
  const ref = useRef<Mesh>(null);
  useEffect(() => (ref.current ? maskBloom(ref.current) : undefined), []);
  return <mesh ref={ref} geometry={geometry} layers={bloomMaskLayer} />;
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
  const materials = useThemedMaterials(buildMaterials, theme, 'projects');
  const palette = palettes[theme];

  const screens = useMemo(() => projects.slice(0, helix.screens), [projects]);

  const hoveredRef = useRef(-1);
  const screenshotTime = useRef(0);
  const tips = useMemo<WorldTip[]>(
    () =>
      screens.map((screen) => ({ label: screen.title.trim(), sub: 'Inspect project' })),
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
      themeScreen(material, i % 2 ? palette.cyan : palette.violet)
    );
  }, [screenMaterials, palette.cyan, palette.violet]);

  const shots = useMemo(
    () => new ScreenShots(gl, screens, states, screenMaterials),
    [gl, screens, states, screenMaterials]
  );
  const maskGeometry = useMemo(() => screenMaskGeometry(), []);
  useEffect(() => () => maskGeometry.dispose(), [maskGeometry]);

  useEffect(() => {
    screens.forEach((_, i) => shots.load(i, 0));
    return () => shots.dispose();
  }, [screens, shots]);

  // Projects with no screenshots show their art, drawn once the icons are in
  const icons = useIconCollections();
  useEffect(() => {
    if (!icons) return;
    screens.forEach((screen, i) => {
      if (screen.images.length) return;
      const svg = iconSvg(icons, screen.icon || 'ph:code-bold', '#ffffff', 256);
      shots.placeholder(i, drawProjectArt(svg, i + 1));
    });
  }, [icons, screens, shots]);

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
    const selected = inspection.get();
    if (!selected) screenshotTime.current = t;
    const inspected = selected?.kind === 'project' ? screens.findIndex((screen) => screen.slug === selected.id) : -1;
    const front =
      inspected >= 0 ? inspected : opened >= 0
        ? opened
        : scrolled >= 0
          ? Math.min(settleFocus(scrolled), screens.length - 1)
          : -1;
    // At the top of the projects page the camera holds back on the whole
    // yard: the first screen only comes forward (and lights up) on scroll
    const ride = front >= 0 ? 1 - (opened >= 0 || inspected >= 0 ? 0 : projectIntro()) : 0;
    const live = front >= 0 && ride > 0.9 ? Math.round(front) : -1;
    // On the page (or a project's), sharp copies load ahead of the camera,
    // nearest the project in front first, so none is ever soft once it gets
    // there (flying in, they download and decode but wait to upload)
    const sharpening = scrolled >= 0 || opened >= 0 || inspected >= 0;
    const sharpWidth = sharpening
      ? frontScreenWidth(size.width, size.height, gl.domElement.height)
      : 0;
    if (sharpWidth) shots.sharpen(sharpWidth, Math.max(front, 0), live);

    setUniform(materials.base, 'uTime', t);
    screenMaterials.forEach((material, i) => {
      const state = states[i];
      setUniform(material, 'uTime', t + i);
      liveScreen(
        material,
        state,
        screens[i].images.length,
        i,
        screenshotTime.current,
        selected ? 0 : dt,
        !selected && (i === live || i === hoveredRef.current),
        shots,
        sharpWidth > 0 && i === live
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
    if (spiral && !isInspecting()) {
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
    <StationScope station="projects">
      <group ref={groupRef} position={stationPositions.projects}>
        <Billboard position={[0, 0.4, -2.5]}>
          <mesh material={materials.haloViolet} scale={9}>
            <planeGeometry />
          </mesh>
        </Billboard>
        <Billboard position={[0, -6, -4]}>
          <mesh material={materials.halo} scale={14}>
            <planeGeometry />
          </mesh>
        </Billboard>

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
                  userData={{ inspection: { kind: 'project', id: screen.slug, station: 'projects' } }}
                  scale={[screenSize.width, screenSize.height, 1]}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    if (hoveredRef.current === i) return;
                    if (hoveredRef.current >= 0) setWorldHover(false);
                    hoveredRef.current = i;
                    setWorldHover(true);
                    tips[i].anchor = e.point.toArray();
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
                    spawnPing(e.point);
                    inspectEntity({ kind: 'project', id: screen.slug, station: 'projects', anchor: e.point.toArray() });
                  }}
                >
                  <planeGeometry />
                </mesh>
                <ScreenMask geometry={maskGeometry} />
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
    </StationScope>
  );
}

