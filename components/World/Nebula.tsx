'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  Color,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
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

import { noiseGlsl } from './materials';
import { galacticCentre, galacticEast, galacticNormal, nebulae, sunDirection } from './sky';
import { palettes } from './utils';
import { useWarmupTask } from './warmup';

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
  uniform vec3 uMilky;
  uniform vec3 uSun;
  uniform vec3 uGalactic;
  uniform vec3 uCentre;
  uniform vec3 uEast;
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
    vec3 bandColour = mix(uMilky, vec3(1.0, 0.88, 0.7), clamp(bulge * 0.9 + toCentre * toCentre * 0.2, 0.0, 1.0));

    // Dust lanes: ridged filaments hugging the plane, and the great rift off the centre
    float lanes = ridged(along * 4.2 + vec3(0.6 * fbm(along * 1.3 + 7.0)));
    float laneMask = exp(-(ab * ab) / 0.012);
    float riftPath = abs(b - 0.025 - 0.02 * snoise(along * 2.0 + 5.0));
    float rift = smoothstep(0.07, 0.015, riftPath) * smoothstep(-0.15, 0.15, glon) * smoothstep(1.9, 1.2, glon);
    float dust = smoothstep(0.25, 0.95, clamp(lanes * 1.4 * laneMask + rift * (0.6 + 0.5 * lanes), 0.0, 1.0));
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
    // A faint diffuse glow, so the deep sky is never flat
    col += uReflection * 0.07 * dark * smoothstep(-0.3, 0.8, fbm(dir * 0.9 + 17.0));
    // Kept under the bloom threshold: only the bulge's core is allowed to glow,
    // or the whole band blooms into a halo of fog
    col += bandColour * band * 0.14 * (1.0 - uLight * 0.65);

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
const domeFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uGrainMap;
  uniform vec2 uSize;
  uniform float uGrain;
  varying vec3 vDir;

  vec4 cubic(float v) {
    vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
    vec4 s = n * n * n;
    float x = s.x;
    float y = s.y - 4.0 * s.x;
    float z = s.z - 4.0 * s.y + 6.0 * s.x;
    return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
  }

  vec4 bicubic(vec2 uv) {
    uv = uv * uSize - 0.5;
    vec2 f = fract(uv);
    uv -= f;
    vec4 xc = cubic(f.x);
    vec4 yc = cubic(f.y);
    vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
    vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
    vec4 o = (c + vec4(xc.yw, yc.yw) / s) / uSize.xxyy;
    vec4 s0 = texture2D(uMap, o.xz);
    vec4 s1 = texture2D(uMap, o.yz);
    vec4 s2 = texture2D(uMap, o.xw);
    vec4 s3 = texture2D(uMap, o.yw);
    float sx = s.x / (s.x + s.y);
    float sy = s.z / (s.z + s.w);
    return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float lon = atan(dir.z, dir.x);
    float lat = asin(clamp(dir.y, -1.0, 1.0));
    vec2 uv = vec2(fract(lon / 6.2831853 + 0.5), lat / 3.1415926 + 0.5);
    vec4 sky = bicubic(uv);
    vec3 col = sky.rgb;
    if (uGrain > 0.0 && sky.a > 0.003) {
      // Random texels, bilinear between them: value noise at ~4px and ~12px on screen
      float g = texture2D(uGrainMap, uv * vec2(9.0, 4.5)).r * 0.55 +
        texture2D(uGrainMap, uv * vec2(3.0, 1.5)).g * 0.45;
      col *= 1.0 + uGrain * sky.a * (g - 0.5) * 1.1;
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

/** Strips per bake: each is one frame's work, so no single draw stalls the GPU */
const stripsFor = (height: number) => Math.max(8, Math.round(height / 128));

/** Compiles the (heavy) bake shader in the background, then renders the sky a strip per frame */
async function bakeNebula(
  renderer: WebGLRenderer,
  target: WebGLRenderTarget,
  theme: WorldTheme,
  octaves: number,
  isCurrent: () => boolean
) {
  const palette = palettes[theme];
  const material = new ShaderMaterial({
    uniforms: {
      uStrength: { value: palette.nebulaStrength },
      uLight: { value: theme === 'light' ? 1 : 0 },
      uBase: { value: new Color(palette.background) },
      // The three gases: reflection violet, oxygen teal, hydrogen pink. They glow
      // on the dark sky (the accents) and tint the light one (its pastels)
      uReflection: { value: new Color(theme === 'light' ? palette.nebula[0] : palette.violet) },
      uOxygen: { value: new Color(theme === 'light' ? palette.nebula[1] : palette.cyan) },
      uHydrogen: { value: new Color(theme === 'light' ? palette.nebula[2] : palette.pink) },
      uDust: { value: new Color(theme === 'light' ? '#d4cde6' : '#120b0a') },
      uMilky: { value: new Color(theme === 'light' ? '#ffffff' : '#cfd3ff') },
      uSun: { value: sunDirection },
      uGalactic: { value: galacticNormal },
      uCentre: { value: galacticCentre },
      uEast: { value: galacticEast },
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
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  const compiled = renderer.compileAsync(scene, camera);
  renderer.setRenderTarget(previous);
  await compiled;

  const { width, height } = target;
  const strips = stripsFor(height);
  for (let i = 0; i < strips && isCurrent(); i++) {
    const restore = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    const y = Math.floor((i * height) / strips);
    const h = Math.floor(((i + 1) * height) / strips) - y;
    target.scissor.set(0, y, width, h);
    target.scissorTest = true;
    renderer.render(scene, camera);
    target.scissorTest = false;
    renderer.setRenderTarget(restore);
    await nextFrame();
  }

  geometry.dispose();
  material.dispose();
}

/**
 * Filters the baked sky (plus a bright panel where the sun is) into the
 * environment map, so metal and painted hulls reflect the sky they sit in.
 */
function buildEnvironment(renderer: WebGLRenderer, sky: WebGLRenderTarget, theme: WorldTheme) {
  const scene = new Scene();
  const domeGeometry = new SphereGeometry(10, 48, 24);
  const domeMaterial = new ShaderMaterial({
    uniforms: {
      uMap: { value: sky.texture },
      uSize: { value: new Vector2(sky.width, sky.height) },
      uGrain: { value: 0 },
    },
    vertexShader: domeVertex,
    fragmentShader: domeFragment,
    side: BackSide,
    depthWrite: false,
  });
  scene.add(new Mesh(domeGeometry, domeMaterial));

  // The sun as a bright disc, and a soft bounce from the opposite side
  const panelGeometry = new SphereGeometry(1, 16, 8);
  const sunMaterial = new MeshBasicMaterial({
    color: new Color('#fff1dc').multiplyScalar(theme === 'light' ? 22 : 34),
  });
  const sun = new Mesh(panelGeometry, sunMaterial);
  sun.position.copy(sunDirection).multiplyScalar(8);
  sun.scale.setScalar(1.1);
  scene.add(sun);
  const bounceMaterial = new MeshBasicMaterial({
    color: new Color(theme === 'light' ? '#c9d4ff' : '#4b3b9a').multiplyScalar(
      theme === 'light' ? 1.2 : 2
    ),
  });
  const bounce = new Mesh(panelGeometry, bounceMaterial);
  bounce.position.copy(sunDirection).multiplyScalar(-8);
  bounce.scale.setScalar(3.5);
  scene.add(bounce);

  const generator = new PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0, 0.1, 30);
  generator.dispose();
  domeGeometry.dispose();
  domeMaterial.dispose();
  panelGeometry.dispose();
  sunMaterial.dispose();
  bounceMaterial.dispose();
  return target;
}

/** Procedural deep-sky dome that always sits around the camera (effectively at infinity) */
export function Nebula({
  theme,
  octaves,
  size,
}: {
  theme: WorldTheme;
  octaves: number;
  size: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const track = useWarmupTask();

  const target = useMemo(() => {
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
  }, [size]);

  const grainMap = useMemo(() => createGrainMap(), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uMap: { value: target.texture },
          uGrainMap: { value: grainMap },
          uSize: { value: new Vector2(target.width, target.height) },
          uGrain: { value: 1 },
        },
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    [target, grainMap]
  );

  // A same-sized stand-in, so everything compiles against the final
  // environment's shader variant before the bake finishes
  useEffect(() => {
    if (scene.environment) return;
    const generator = new PMREMGenerator(gl);
    const placeholder = generator.fromScene(new Scene(), 0, 0.1, 30);
    generator.dispose();
    applyEnvironment(scene, placeholder.texture);
  }, [gl, scene]);

  useEffect(() => {
    let current = true;
    let environment: WebGLRenderTarget | null = null;
    track(
      bakeNebula(gl, target, theme, octaves, () => current).then(() => {
        if (!current) return;
        environment = buildEnvironment(gl, target, theme);
        applyEnvironment(scene, environment.texture);
      })
    );
    return () => {
      current = false;
      environment?.dispose();
    };
  }, [gl, scene, target, theme, octaves, track]);

  useEffect(
    () => () => {
      material.dispose();
      target.dispose();
      grainMap.dispose();
    },
    [material, target, grainMap]
  );

  useFrame(({ camera }) => {
    meshRef.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={meshRef} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[900, 48, 32]} />
    </mesh>
  );
}

function applyEnvironment(scene: Scene, texture: Texture) {
  scene.environment = texture;
  scene.environmentIntensity = 1;
}
