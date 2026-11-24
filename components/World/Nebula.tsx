'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  BufferGeometry,
  Color,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector4,
  WebGLRenderTarget,
} from 'three';

import { motionLevel } from '@/utils/motion';

import { noiseGlsl } from './materials';
import {
  backdropDirection,
  backdropMajor,
  backdropMinor,
  galacticCentre,
  galacticEast,
  galacticNormal,
  nebulae,
  sunDirection,
} from './sky';
import { palettes, setUniform } from './utils';
import { useWarmupTask } from './warmup';
import { worldStore } from './worldStore';

import type { Texture, WebGLRenderer } from 'three';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Deep sky. A bake pass renders the sky once into an equirectangular
   texture, then the dome samples it, so the per-frame cost is one read.

   The Milky Way is built in its own frame (galactic longitude towards
   the bulge, latitude off the plane): a thin disc with faint wings,
   brighter and thicker towards the centre, textured by star clouds and
   the fine grain of unresolved stars, and cut by filamentary dust lanes
   that hug the plane (one long rift running off the centre), which
   absorb and redden whatever lies behind them. Noise for anything in
   the band is sampled with the plane direction stretched, so features
   run along it the way they really do.

   Far beyond it, behind the stations' cameras, a tilted spiral galaxy
   (sky.ts backdropDirection): seen on the way back towards Home.

   Nebulae are local: a handful of star-forming complexes strung along
   the plane, each with a ragged outline, billowy gas threaded with
   filaments, dark dust pillars in silhouette and a lit core that
   brightens and whitens the gas around it. Between them the sky is
   dark, with only a faint diffuse glow.

   The same texture lights the scene: it is filtered into the
   environment map the stations' metal reflects.
   ------------------------------------------------------------------ */
const bakeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const bakeFragment = /* glsl */ `
  uniform float uStrength;
  uniform float uLight;
  uniform vec3 uBase;
  uniform vec3 uReflection;
  uniform vec3 uOxygen;
  uniform vec3 uHydrogen;
  uniform vec3 uDust;
  uniform float uDetail;
  uniform vec3 uMilky;
  uniform vec3 uSun;
  uniform vec3 uGalactic;
  uniform vec3 uCentre;
  uniform vec3 uEast;
  uniform vec3 uBackdrop;
  uniform vec3 uBackdropMajor;
  uniform vec3 uBackdropMinor;
  uniform vec4 uNebula[NEBULAE];
  uniform float uNebulaKind[NEBULAE];
  varying vec2 vUv;
  ${noiseGlsl}

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  // Billowy: layered |noise|, the texture of lit gas
  float turbulence(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < OCTAVES; i++) {
      value += amplitude * abs(snoise(p));
      p *= 2.07;
      amplitude *= 0.5;
    }
    return value;
  }

  // Ridged: sharp bright lines where the noise crosses zero, for filaments and lanes
  float ridged(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float weight = 1.0;
    for (int i = 0; i < OCTAVES; i++) {
      float n = 1.0 - abs(snoise(p));
      n *= n;
      value += amplitude * n * weight;
      weight = clamp(n * 2.0, 0.0, 1.0);
      p *= 2.1;
      amplitude *= 0.5;
    }
    return value;
  }

  // Faint stars: one candidate per grid cell, most cells empty
  float stars(vec3 dir, float scale, float density) {
    vec3 p = dir * scale;
    vec3 cell = floor(p);
    float h = hash(cell);
    if (h < 1.0 - density) return 0.0;
    vec3 centre = cell + 0.5 + 0.35 * (vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 4.1)) - 0.5);
    float d = length(p - centre);
    float size = 0.08 + 0.18 * hash(cell + 7.7);
    return smoothstep(size, 0.0, d) * (0.35 + 0.65 * hash(cell + 9.1));
  }

  void main() {
    float lon = (vUv.x - 0.5) * 6.2831853;
    float lat = (vUv.y - 0.5) * 3.1415926;
    vec3 dir = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
    float dark = 1.0 - uLight;

    // ----- The Milky Way, in the galactic frame -----
    float gx = dot(dir, uCentre);
    float gy = dot(dir, uGalactic);
    float gz = dot(dir, uEast);
    // Features along the plane: the across-plane axis is stretched
    vec3 along = vec3(gx, gy * 2.6, gz);
    float toCentre = gx * 0.5 + 0.5;
    float glon = atan(gz, gx);
    // The plane wanders a little, so the band is never a ruled line
    float b = asin(clamp(gy, -1.0, 1.0)) + 0.09 * fbm(along * 1.6 + 3.0);
    float ab = abs(b);

    // A thin disc with wide faint wings, thicker and brighter towards the bulge
    float thick = 0.06 + 0.07 * toCentre * toCentre;
    float disc = exp(-pow(ab / thick, 1.35));
    float wings = exp(-ab / 0.3) * 0.08;
    float bulge = exp(-(ab * ab) / 0.06) * exp(-(1.0 - gx) * 3.2);
    // Star clouds at two scales, and the grain of countless unresolved stars
    float clouds = (0.4 + 0.8 * smoothstep(-0.3, 0.7, fbm(along * 3.3 + 11.0))) *
      (0.75 + 0.4 * smoothstep(-0.5, 0.5, fbm(along * 9.0 + 23.0)));
    float grain = 0.82 + 0.36 * snoise(along * 46.0) * disc;
    float band = (disc * clouds * grain + wings) * (0.4 + 0.6 * toCentre) + bulge * 1.1;
    // Cool white out in the arms, warming to cream only around the bulge
    // A bake too small to resolve the band (uDetail) gets a warmer, more coloured bulge instead
    vec3 bulgeColour = mix(vec3(1.0, 0.88, 0.7), vec3(1.0, 0.76, 0.5), uDetail);
    vec3 bandColour = mix(uMilky, bulgeColour, clamp(bulge * (0.9 + 0.4 * uDetail) + toCentre * toCentre * 0.2, 0.0, 1.0));

    // Dust lanes: ridged filaments hugging the plane, and the great rift off the centre
    float lanes = ridged(along * 4.2 + vec3(0.6 * fbm(along * 1.3 + 7.0)));
    float laneMask = exp(-(ab * ab) / 0.012);
    float riftPath = abs(b - 0.025 - 0.02 * snoise(along * 2.0 + 5.0));
    float rift = smoothstep(0.07, 0.015, riftPath) * smoothstep(-0.15, 0.15, glon) * smoothstep(1.9, 1.2, glon);
    // …and darker, wider dust around it, so the band never reads as a smooth grey
    float dust = smoothstep(0.25 - 0.1 * uDetail * toCentre, 0.95, clamp(lanes * 1.4 * laneMask + rift * (0.6 + 0.5 * lanes), 0.0, 1.0));
    float absorb = dust * 0.9 * (1.0 - uLight * 0.7);

    // ----- Nebula complexes -----
    float mask = 0.0;
    float kind = 0.0;
    float lit = 0.0;
    float edge = fbm(dir * 2.6 + 5.0);
    for (int i = 0; i < NEBULAE; i++) {
      vec4 n = uNebula[i];
      float a = acos(clamp(dot(dir, n.xyz), -1.0, 1.0));
      float r = n.w * (0.7 + 0.55 * edge);
      float m = smoothstep(r, r * 0.25, a);
      mask += m;
      kind += m * uNebulaKind[i];
      lit += exp(-a * a / (n.w * n.w * 0.06));
    }
    kind /= max(mask, 1e-3);
    mask = clamp(mask, 0.0, 1.0);

    // ----- Compose, back to front -----
    vec3 col = uBase;
    // Daylight: the sky deepens a little and cools along the galactic plane,
    // paling towards its poles, and warms on the sun's side
    vec3 day = mix(uBase * vec3(0.93, 0.94, 0.985), mix(uBase, vec3(1.0), 0.4), smoothstep(0.0, 1.1, ab));
    day += vec3(1.0, 0.82, 0.62) * pow(max(dot(dir, uSun), 0.0), 4.0) * 0.12;
    col = mix(col, day, uLight);
    // A faint diffuse glow, so the deep sky is never flat
    col += uReflection * 0.07 * dark * smoothstep(-0.3, 0.8, fbm(dir * 0.9 + 17.0));
    // Kept under the bloom threshold: only the bulge's core is allowed to glow,
    // or the whole band blooms into a halo of fog
    col += bandColour * band * 0.14 * dark;
    // In daylight the band is a soft wash of ink instead of light
    float wash = clamp(disc * clouds * (0.5 + 0.5 * toCentre) + wings * 1.5 + bulge * 0.7, 0.0, 1.0);
    col = mix(col, col * vec3(0.82, 0.83, 0.92), wash * 0.5 * uLight);

    // ----- A distant spiral galaxy, tilted, in the backdrop -----
    // Gnomonic coordinates on the sky in galaxy radii, then unsquashed onto
    // its disc: an exponential disc, two log-spiral arms broken into clumps,
    // a warm bulge, and a dust lane along the near side of the centre
    float facing = dot(dir, uBackdrop);
    if (facing > 0.98) {
      vec2 p = vec2(dot(dir, uBackdropMajor), dot(dir, uBackdropMinor)) / (facing * 0.14);
      vec2 q = vec2(p.x, p.y / 0.42);
      float r = length(q);
      float phi = atan(q.y, q.x);
      float clumps = turbulence(vec3(q * 5.0, 3.7));
      float galaxyDisc = exp(-r / 0.22) * smoothstep(1.2, 0.5, r);
      // Clamped: 0.5 + 0.5 * cos() can round just below 0, and pow() of a
      // negative base is NaN on Apple GPUs (a NaN texel blacks out the frame)
      float spiral = clamp(0.5 + 0.5 * cos(2.0 * (phi - 3.4 * log(max(r, 1e-3)))), 0.0, 1.0);
      float arms = pow(spiral, 2.5) * (0.4 + 0.9 * clumps) * smoothstep(0.06, 0.28, r) *
        exp(-r / 0.42) * smoothstep(1.1, 0.65, r);
      float galaxyBulge = exp(-r * r / 0.014);
      float laneY = (p.y - 0.05) / 0.06;
      float galaxyLane = exp(-laneY * laneY) * smoothstep(0.8, 0.12, abs(p.x)) * (0.55 + 0.6 * clumps);
      float knots = arms * smoothstep(0.62, 0.9, clumps);
      // Its core well under the bloom threshold, like the band's
      vec3 glow = vec3(0.55, 0.6, 0.78) * galaxyDisc * 0.12 + vec3(0.7, 0.78, 1.0) * arms * 0.16 +
        vec3(1.0, 0.84, 0.6) * galaxyBulge * 0.4 + uHydrogen * knots * 0.12;
      col += glow * (1.0 - 0.8 * clamp(galaxyLane, 0.0, 1.0)) * dark;
      // Light sky: a soft wash of ink, deepest in the lane
      float ink = clamp(galaxyDisc * 0.7 + arms * 1.1 + galaxyBulge * 0.9 + galaxyLane * 0.4, 0.0, 1.0);
      col = mix(col, col * vec3(0.72, 0.74, 0.9), ink * 0.7 * uLight);
    }

    // Faint stars, denser in the band
    float s = stars(dir, 420.0, 0.012 + 0.04 * disc) + stars(dir, 900.0, 0.02 + 0.06 * disc) * 0.6;
    vec3 starTint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), hash(floor(dir * 420.0) + 3.3));
    col += starTint * s * dark;

    // Dust absorbs: darkens and reddens what is behind it
    col = mix(col, uDust * (0.6 + 0.4 * band), absorb);

    if (mask > 0.002) {
      vec3 q = dir * 3.4;
      vec3 w = vec3(fbm(q + 1.7), fbm(q + 8.3), fbm(q + 4.1));
      float gas = turbulence(q + w * 0.9 + 20.0);
      float filaments = ridged(dir * 7.0 + w * 1.4 + 30.0);
      float pillars = ridged(dir * 4.6 + w * 0.5 + 50.0);
      float body = smoothstep(0.2, 0.7, gas) * (0.6 + 0.8 * filaments);
      // Dust pillars in silhouette where the gas is thick
      float occlusion = smoothstep(0.6, 0.95, pillars) * smoothstep(0.3, 0.9, gas) * mask * 0.85 * (1.0 - uLight * 0.75);
      col *= 1.0 - occlusion;
      // Hydrogen pink or oxygen teal, drifting across each complex; the cores whiten
      float drift = clamp(kind + 0.35 * fbm(dir * 1.4 + 9.0), 0.0, 1.0);
      vec3 emission = mix(uHydrogen, uOxygen, drift);
      float core = clamp(lit, 0.0, 1.0);
      emission = mix(emission, vec3(1.0, 0.96, 0.9), core * 0.25);
      float amount = clamp(body * mask * uStrength * (1.0 + 1.6 * core), 0.0, 1.0);
      // Dark sky: the gas glows. Light sky: it tints
      col += emission * amount * 0.95 * dark;
      col = mix(col, emission, min(amount * 1.4, 1.0) * uLight);
      // The core's light scattered by the gas around it, and a bluish reflection
      col += (emission * 0.2 + uReflection * 0.25) * core * gas * mask * dark;
    }

    // Glow around the sun
    float sun = max(dot(dir, uSun), 0.0);
    col += vec3(1.0, 0.9, 0.78) * (pow(sun, 48.0) * 0.5 + pow(sun, 6.0) * 0.06) * mix(1.0, 0.4, uLight);

    // Alpha: where the dome adds the fine grain of unresolved stars at screen resolution
    float grainy = clamp((disc * clouds + bulge) * dark, 0.0, 1.0) * (1.0 - absorb);
    gl_FragColor = vec4(col, grainy);
  }
`;

const domeVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The bake is magnified several times on screen, where plain bilinear
// filtering shows its texel grid along the sharp dust lanes. A cubic
// B-spline (four bilinear taps) keeps the sky smooth, and the band gets
// the fine grain of unresolved stars added at screen resolution (the
// bake's alpha says where), so it never reads as a soft smear up close.
// A theme change crossfades from one bake (uMapA) to the next (uMapB):
// only while uMix is between 0 and 1 does it read both.
const domeFragment = /* glsl */ `
  uniform sampler2D uMapA;
  uniform sampler2D uMapB;
  uniform float uMix;
  uniform sampler2D uGrainMap;
  uniform vec2 uSize;
  uniform float uGrain;
  uniform float uWarp;
  varying vec3 vDir;

  vec4 cubic(float v) {
    vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
    vec4 s = n * n * n;
    float x = s.x;
    float y = s.y - 4.0 * s.x;
    float z = s.z - 4.0 * s.y + 6.0 * s.x;
    return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
  }

  vec4 bicubic(sampler2D map, vec2 uv) {
    uv = uv * uSize - 0.5;
    vec2 f = fract(uv);
    uv -= f;
    vec4 xc = cubic(f.x);
    vec4 yc = cubic(f.y);
    vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
    vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
    vec4 o = (c + vec4(xc.yw, yc.yw) / s) / uSize.xxyy;
    vec4 s0 = texture2D(map, o.xz);
    vec4 s1 = texture2D(map, o.yz);
    vec4 s2 = texture2D(map, o.xw);
    vec4 s3 = texture2D(map, o.yw);
    float sx = s.x / (s.x + s.y);
    float sy = s.z / (s.z + s.w);
    return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float lon = atan(dir.z, dir.x);
    float lat = asin(clamp(dir.y, -1.0, 1.0));
    vec2 uv = vec2(fract(lon / 6.2831853 + 0.5), lat / 3.1415926 + 0.5);
    vec4 sky = bicubic(uMapA, uv);
    if (uMix > 0.0) sky = mix(sky, bicubic(uMapB, uv), uMix);
    vec3 col = sky.rgb;
    // At warp speed the band and bulge (where the alpha is) dim to 45% and
    // lose their grain: magnified, streaked and blurred, they smeared the
    // whole frame into a flat grey
    col *= 1.0 - 0.55 * uWarp * smoothstep(0.0, 0.5, sky.a);
    float grain = uGrain * (1.0 - uWarp);
    if (grain > 0.0 && sky.a > 0.003) {
      // Random texels, bilinear between them: value noise at ~4px and ~12px on screen
      float g = texture2D(uGrainMap, uv * vec2(9.0, 4.5)).r * 0.55 +
        texture2D(uGrainMap, uv * vec2(3.0, 1.5)).g * 0.45;
      col *= 1.0 + grain * sky.a * (g - 0.5) * 1.1;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** A small tile of random texels; the dome reads it, magnified, as star grain */
function createGrainMap() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(Math.random() * 256);
  const texture = new DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Strips per bake, each one frame's work, so no single draw holds the GPU
 * for long. A strip's cost follows its area, plus a small fixed cost for
 * binding the target: on an M3 Pro the whole desktop bake is ~40ms of GPU
 * work, a 600k-pixel strip ~6ms and a 250k-pixel phone strip ~3ms
 */
const stripsFor = (width: number, height: number, budget: number) =>
  Math.max(1, Math.round((width * height) / budget));

/**
 * Pixels per bake strip: eight strips for the desktop's 3072 bake and for a
 * phone's 2048. Phones' GPUs are several times slower, so theirs are smaller
 */
const stripBudget = { desktop: 600_000, phone: 250_000 };

/**
 * The bake's size. Phones ask for 1024, which magnified on a narrow screen
 * blurs the band into a smooth grey; they get 2048 where memory allows (16MB
 * per target, two after a theme change), else a richer bulge (uDetail)
 */
function bakeSizeFor(requested: number, renderer: WebGLRenderer) {
  if (requested >= 2048) return { size: requested, detail: 0 };
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const roomy =
    (memory === undefined || memory >= 4) && renderer.capabilities.maxTextureSize >= 4096;
  return roomy ? { size: 2048, detail: 0 } : { size: requested, detail: 1 };
}

/** Seconds the dome takes to crossfade from one theme's sky to the next */
const crossfade = 0.9;

/** The bake: one material for the canvas's life, compiled once, its uniforms set per theme */
interface Bake {
  /** Pixels per strip */
  budget: number;
  material: ShaderMaterial;
  geometry: PlaneGeometry;
  scene: Scene;
  camera: OrthographicCamera;
}

function createBake(octaves: number, detail: number, budget: number): Bake {
  const material = new ShaderMaterial({
    uniforms: {
      uStrength: { value: 0 },
      uLight: { value: 0 },
      uBase: { value: new Color() },
      uReflection: { value: new Color() },
      uOxygen: { value: new Color() },
      uHydrogen: { value: new Color() },
      uDust: { value: new Color() },
      uMilky: { value: new Color() },
      uDetail: { value: detail },
      uSun: { value: sunDirection },
      uGalactic: { value: galacticNormal },
      uCentre: { value: galacticCentre },
      uEast: { value: galacticEast },
      uBackdrop: { value: backdropDirection },
      uBackdropMajor: { value: backdropMajor },
      uBackdropMinor: { value: backdropMinor },
      uNebula: {
        value: nebulae.map(
          (n) => new Vector4(n.direction.x, n.direction.y, n.direction.z, n.radius)
        ),
      },
      uNebulaKind: { value: nebulae.map((n) => n.kind) },
    },
    defines: { OCTAVES: octaves, NEBULAE: nebulae.length },
    vertexShader: bakeVertex,
    fragmentShader: bakeFragment,
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  return {
    budget,
    material,
    geometry,
    scene,
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
  };
}

/** The bake's colours for a theme */
function themeBake(bake: Bake, theme: WorldTheme) {
  const palette = palettes[theme];
  const light = theme === 'light';
  const uniforms = bake.material.uniforms;
  uniforms.uStrength.value = palette.nebulaStrength;
  uniforms.uLight.value = light ? 1 : 0;
  (uniforms.uBase.value as Color).set(palette.background);
  // The three gases: reflection violet, oxygen teal, hydrogen pink. They glow
  // on the dark sky (the accents) and tint the light one (its pastels)
  (uniforms.uReflection.value as Color).set(light ? palette.nebula[0] : palette.violet);
  (uniforms.uOxygen.value as Color).set(light ? palette.nebula[1] : palette.cyan);
  (uniforms.uHydrogen.value as Color).set(light ? palette.nebula[2] : palette.pink);
  (uniforms.uDust.value as Color).set(light ? '#d4cde6' : '#120b0a');
  (uniforms.uMilky.value as Color).set(light ? '#ffffff' : '#cfd3ff');
}

/**
 * Renders a theme's sky into `target` a strip per frame, so no single draw
 * stalls the GPU. The first call compiles the bake shader in the background;
 * later ones find it compiled. Resolves true once the whole sky is baked,
 * false if a newer request took over on the way
 */
async function bakeSky(
  renderer: WebGLRenderer,
  bake: Bake,
  theme: WorldTheme,
  target: WebGLRenderTarget,
  isCurrent: () => boolean
) {
  themeBake(bake, theme);
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  const compiled = renderer.compileAsync(bake.scene, bake.camera);
  renderer.setRenderTarget(previous);
  await compiled;

  const { width, height } = target;
  const strips = stripsFor(width, height, bake.budget);
  for (let i = 0; i < strips; i++) {
    if (!isCurrent()) return false;
    // Another bake may have set the uniforms for its theme between strips
    themeBake(bake, theme);
    // The strip's scissor goes on the target before it is bound: three only
    // copies a target's scissor into GL state in setRenderTarget, so set after
    // the bind, every strip shaded (and cleared) the whole sky
    const y = Math.floor((i * height) / strips);
    const h = Math.floor(((i + 1) * height) / strips) - y;
    target.scissor.set(0, y, width, h);
    target.scissorTest = true;
    const restore = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(bake.scene, bake.camera);
    renderer.setRenderTarget(restore);
    target.scissorTest = false;
    await nextFrame();
  }
  return isCurrent();
}

/**
 * What the environment map is filtered from: the baked sky on a small dome,
 * plus a bright panel where the sun is and a soft bounce opposite it, so
 * metal and painted hulls reflect the sky they sit in. One generator and one
 * set of materials for the canvas's life: a fresh PMREMGenerator compiles
 * its filter shaders again, which stalled every theme change
 */
interface EnvironmentKit {
  generator: PMREMGenerator;
  scene: Scene;
  dome: ShaderMaterial;
  sun: MeshBasicMaterial;
  bounce: MeshBasicMaterial;
  geometries: BufferGeometry[];
}

function createEnvironmentKit(renderer: WebGLRenderer, size: Vector2): EnvironmentKit {
  const scene = new Scene();
  const domeGeometry = new SphereGeometry(10, 48, 24);
  const dome = new ShaderMaterial({
    uniforms: {
      uMapA: { value: null },
      uMapB: { value: null },
      uMix: { value: 0 },
      uGrainMap: { value: null },
      uSize: { value: size },
      uGrain: { value: 0 },
      uWarp: { value: 0 },
    },
    vertexShader: domeVertex,
    fragmentShader: domeFragment,
    side: BackSide,
    depthWrite: false,
  });
  scene.add(new Mesh(domeGeometry, dome));
  const panelGeometry = new SphereGeometry(1, 16, 8);
  const sun = new MeshBasicMaterial();
  const sunPanel = new Mesh(panelGeometry, sun);
  sunPanel.position.copy(sunDirection).multiplyScalar(8);
  sunPanel.scale.setScalar(1.1);
  scene.add(sunPanel);
  const bounce = new MeshBasicMaterial();
  const bouncePanel = new Mesh(panelGeometry, bounce);
  bouncePanel.position.copy(sunDirection).multiplyScalar(-8);
  bouncePanel.scale.setScalar(3.5);
  scene.add(bouncePanel);
  return {
    generator: new PMREMGenerator(renderer),
    scene,
    dome,
    sun,
    bounce,
    geometries: [domeGeometry, panelGeometry],
  };
}

/** Filters a baked sky into a new environment map (the caller applies it and retires the old one) */
function buildEnvironment(kit: EnvironmentKit, sky: Texture, theme: WorldTheme) {
  const light = theme === 'light';
  kit.dome.uniforms.uMapA.value = sky;
  kit.dome.uniforms.uMapB.value = sky;
  kit.sun.color.set('#fff1dc').multiplyScalar(light ? 22 : 34);
  kit.bounce.color.set(light ? '#c9d4ff' : '#4b3b9a').multiplyScalar(light ? 1.2 : 2);
  return kit.generator.fromScene(kit.scene, 0, 0.1, 30);
}

function disposeEnvironmentKit(kit: EnvironmentKit) {
  kit.generator.dispose();
  kit.dome.dispose();
  kit.sun.dispose();
  kit.bounce.dispose();
  kit.geometries.forEach((geometry) => geometry.dispose());
}

function createSkyTarget(size: number) {
  // Half-float keeps the dark, linear-space gradients free of banding
  const target = new WebGLRenderTarget(size, size / 2, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
  });
  // Wraps round the seam, so the filter's outer taps meet up
  target.texture.wrapS = RepeatWrapping;
  return target;
}

/**
 * The deep sky's state: two bake targets (the second made on the first
 * theme change), which theme each holds, the one on show (`front`) and how
 * far the dome has faded towards the other (`mix`, heading for `goal`).
 * A theme change bakes into the back target while the front stays on show,
 * fades the dome across, then swaps them and only then rebuilds the
 * environment map from the new sky, retiring the old map a frame after the
 * new one is applied, so hulls never draw a frame without reflections.
 * Plain data changed only through the functions below (never in render)
 */
interface Sky {
  size: number;
  bake: Bake;
  kit: EnvironmentKit;
  dome: ShaderMaterial;
  grainMap: DataTexture;
  targets: [WebGLRenderTarget, WebGLRenderTarget | null];
  holds: [WorldTheme | null, WorldTheme | null];
  front: 0 | 1;
  mix: number;
  goal: 0 | 1;
  /** Bumped by every request, so a bake a newer request overtook stops */
  generation: number;
  environment: WebGLRenderTarget | null;
  environmentTheme: WorldTheme | null;
  /** Environment maps replaced this frame, disposed on the next */
  retired: WebGLRenderTarget[];
  /** 0..1, how far into warp speed the camera is (eased) */
  warp: number;
}

function createSky(renderer: WebGLRenderer, requested: number, octaves: number): Sky {
  const { size, detail } = bakeSizeFor(requested, renderer);
  const front = createSkyTarget(size);
  const uSize = new Vector2(front.width, front.height);
  const grainMap = createGrainMap();
  // Bound to the front target before it is baked, but never drawn before:
  // the sky is made once per canvas, and warm-up (which waits for the first
  // bake) holds the frameloop until then
  const dome = new ShaderMaterial({
    uniforms: {
      uMapA: { value: front.texture },
      uMapB: { value: front.texture },
      uMix: { value: 0 },
      uGrainMap: { value: grainMap },
      uSize: { value: uSize },
      uGrain: { value: 1 },
      uWarp: { value: 0 },
    },
    vertexShader: domeVertex,
    fragmentShader: domeFragment,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  return {
    size,
    bake: createBake(octaves, detail, requested < 2048 ? stripBudget.phone : stripBudget.desktop),
    warp: 0,
    kit: createEnvironmentKit(renderer, uSize),
    dome,
    grainMap,
    targets: [front, null],
    holds: [null, null],
    front: 0,
    mix: 0,
    goal: 0,
    generation: 0,
    environment: null,
    environmentTheme: null,
    retired: [],
  };
}

function disposeSky(sky: Sky) {
  sky.generation++;
  if (skyMap.value === sky.targets[0].texture || skyMap.value === sky.targets[1]?.texture) {
    skyMap.value = null;
  }
  sky.targets.forEach((target) => target?.dispose());
  sky.bake.material.dispose();
  sky.bake.geometry.dispose();
  disposeEnvironmentKit(sky.kit);
  sky.dome.dispose();
  sky.grainMap.dispose();
  sky.environment?.dispose();
  sky.retired.forEach((target) => target.dispose());
}

/**
 * Points the dome at the front bake (and the back one to fade to), and
 * shares the front as skyMap. A target still being baked is never bound:
 * drawing with a texture bound that is also being rendered into, even
 * unread, made the GPU synchronise on every strip (ANGLE on Metal), which
 * cost each strip of a theme change's bake a dropped frame or two
 */
function bindSky(sky: Sky) {
  const front = sky.targets[sky.front]!;
  const back = (sky.holds[1 - sky.front] && sky.targets[1 - sky.front]) || front;
  sky.dome.uniforms.uMapA.value = front.texture;
  sky.dome.uniforms.uMapB.value = back.texture;
  sky.dome.uniforms.uMix.value = sky.mix;
  skyMap.value = front.texture;
}

/** Rebuilds the environment map from the sky on show and applies it */
function refreshEnvironment(sky: Sky, scene: Scene, theme: WorldTheme) {
  const next = buildEnvironment(sky.kit, sky.targets[sky.front]!.texture, theme);
  applyEnvironment(scene, next.texture);
  if (sky.environment) sky.retired.push(sky.environment);
  sky.environment = next;
  sky.environmentTheme = theme;
}

/**
 * A same-sized stand-in environment, so everything compiles against the
 * final environment's shader variant before the bake finishes. Filtering it
 * compiles the generator's own shaders, and the environment scene's
 * materials are compiled alongside, all during warm-up
 */
function installPlaceholder(sky: Sky, renderer: WebGLRenderer, scene: Scene) {
  if (sky.environment) return null;
  sky.environment = sky.kit.generator.fromScene(new Scene(), 0, 0.1, 30);
  applyEnvironment(scene, sky.environment.texture);
  // Compiled as it will be drawn: into a half-float target
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(sky.targets[0]);
  const compiled = renderer.compileAsync(sky.kit.scene, new PerspectiveCamera());
  renderer.setRenderTarget(previous);
  return compiled;
}

/**
 * Asks for a theme's sky. The first bakes straight into the front target
 * and builds the environment at once (it runs during warm-up); later ones
 * bake into the back target and leave the crossfade to stepSky. Returns
 * the bake, for warm-up tracking, or null when the sky is already baked
 */
function requestSky(
  sky: Sky,
  renderer: WebGLRenderer,
  scene: Scene,
  theme: WorldTheme,
  invalidate: () => void
) {
  const generation = ++sky.generation;
  const isCurrent = () => sky.generation === generation;
  const front = sky.front;
  const back = (1 - front) as 0 | 1;

  if (sky.holds[front] === theme || sky.holds[back] === theme) {
    sky.goal = sky.holds[front] === theme ? 0 : 1;
    invalidate();
    return null;
  }

  if (sky.holds[front] === null) {
    return bakeSky(renderer, sky.bake, theme, sky.targets[front]!, isCurrent).then((done) => {
      if (!done) return;
      sky.holds[front] = theme;
      sky.mix = 0;
      sky.goal = 0;
      bindSky(sky);
      refreshEnvironment(sky, scene, theme);
      invalidate();
    });
  }

  // Bake the new theme behind the one on show (never while it's fading in)
  sky.goal = 0;
  sky.mix = 0;
  sky.holds[back] = null;
  bindSky(sky);
  const target = sky.targets[back] ?? createSkyTarget(sky.size);
  sky.targets[back] = target;
  return bakeSky(renderer, sky.bake, theme, target, isCurrent).then((done) => {
    if (!done) return;
    sky.holds[back] = theme;
    sky.goal = 1;
    bindSky(sky);
    invalidate();
  });
}

/**
 * Per frame: disposes environment maps replaced last frame (that frame drew
 * with the new one), moves the crossfade on (at once when nothing may move),
 * swaps the targets when it completes, and rebuilds the environment from
 * the sky on show once the fade has settled
 */
function stepSky(sky: Sky, scene: Scene, delta: number, invalidate: () => void) {
  if (sky.retired.length) {
    sky.retired.forEach((target) => target.dispose());
    sky.retired.length = 0;
  }
  if (sky.mix === sky.goal) return;
  const step = motionLevel() === 'still' ? 1 : Math.min(delta, 0.1) / crossfade;
  sky.mix =
    sky.goal > sky.mix ? Math.min(sky.goal, sky.mix + step) : Math.max(sky.goal, sky.mix - step);
  if (sky.mix >= 1) {
    sky.front = (1 - sky.front) as 0 | 1;
    sky.mix = 0;
    sky.goal = 0;
  }
  bindSky(sky);
  const shown = sky.holds[sky.front];
  if (sky.mix === sky.goal && shown && shown !== sky.environmentTheme) {
    refreshEnvironment(sky, scene, shown);
  }
  // A frame to dispose what was retired (rendering on demand, none would come)
  invalidate();
}

/** Eases the dome's warp (band dimmed, grain off) towards the camera's speed: 40 to 140 units/s */
function followWarp(sky: Sky, delta: number) {
  const goal = MathUtils.smoothstep(worldStore.velocity, 40, 140);
  sky.warp = MathUtils.damp(sky.warp, goal, 6, Math.min(delta, 0.1));
  if (sky.warp < 1e-3 && goal === 0) sky.warp = 0;
  setUniform(sky.dome, 'uWarp', sky.warp);
}

/**
 * The baked sky (an equirectangular half-float texture, longitude round x),
 * shared as a uniform for anything that shows the sky through itself, bent
 * (the home portal). Empty until the first bake; it moves to the new bake
 * once a theme change's crossfade completes
 */
export const skyMap: { value: Texture | null } = { value: null };

/** Procedural deep-sky dome that always sits around the camera (effectively at infinity) */
export function Nebula({
  theme,
  octaves,
  size,
}: {
  theme: WorldTheme;
  /** Read once, at mount */
  octaves: number;
  /**
   * The bake's width as asked for (half as tall), read once, at mount; phones'
   * 1024 becomes 2048 where memory allows
   */
  size: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const track = useWarmupTask();

  // The bake's size and detail are decided once, like shadows. A window
  // resized across the lite breakpoint used to rebuild the sky while the
  // world was drawing: a new bake program to compile, hulls on an empty
  // environment, and the dome showing its new target black, then filling
  // in strip by strip as it baked
  const [spec] = useState(() => ({ size, octaves }));
  const sky = useMemo(() => createSky(gl, spec.size, spec.octaves), [gl, spec]);
  useEffect(() => () => disposeSky(sky), [sky]);

  // Before WarmupGate's precompile (an earlier sibling's effects run first)
  useEffect(() => {
    const compiled = installPlaceholder(sky, gl, scene);
    if (compiled) track(compiled);
  }, [sky, gl, scene, track]);

  useEffect(() => {
    const bake = requestSky(sky, gl, scene, theme, invalidate);
    if (bake) track(bake);
  }, [sky, gl, scene, theme, invalidate, track]);

  useFrame(({ camera }, delta) => {
    meshRef.current?.position.copy(camera.position);
    followWarp(sky, delta);
    stepSky(sky, scene, delta, invalidate);
  });

  return (
    <mesh ref={meshRef} material={sky.dome} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[900, 48, 32]} />
    </mesh>
  );
}

function applyEnvironment(scene: Scene, texture: Texture) {
  scene.environment = texture;
  scene.environmentIntensity = 1;
}
