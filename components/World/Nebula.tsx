'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  Color,
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
  WebGLRenderTarget,
} from 'three';

import { noiseGlsl } from './materials';
import { galacticNormal, sunDirection } from './sky';
import { palettes } from './utils';
import { useWarmupTask } from './warmup';

import type { Texture, WebGLRenderer } from 'three';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Deep sky. A bake pass renders the sky once into an equirectangular
   texture: domain-warped emission clouds cut by dark dust lanes, bright
   star-forming knots, the Milky Way band, thousands of faint stars and
   the glow around the sun. The dome then samples it, so the per-frame
   cost is one texture read. The same texture lights the scene: it is
   filtered into the environment map the stations' metal reflects.
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
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uDust;
  uniform vec3 uMilky;
  uniform vec3 uSun;
  uniform vec3 uGalactic;
  varying vec2 vUv;
  ${noiseGlsl}

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float warped(vec3 p) {
    vec3 q = vec3(fbm(p), fbm(p + vec3(5.2, 1.3, 2.8)), fbm(p + vec3(1.7, 9.2, 3.1)));
    return fbm(p + 1.7 * q);
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

    // Milky Way: a soft band around the galactic plane with a brighter core
    float g = dot(dir, uGalactic);
    float band = exp(-g * g * 14.0);
    float core = exp(-g * g * 70.0);

    // Emission clouds, warped into filaments
    float n = warped(dir * 1.25);
    float cloudA = smoothstep(-0.05, 0.85, n);
    float cloudB = smoothstep(0.05, 0.85, warped(dir * 1.9 + vec3(4.0, 0.7, 1.3)));
    float cloudC = smoothstep(0.3, 0.95, warped(dir * 2.6 - vec3(2.0, 1.0, 0.5)));
    float detail = fbm(dir * 7.0 + n * 2.0) * 0.5 + 0.5;

    // Bright star-forming knots where the clouds are densest
    float knots = smoothstep(0.55, 0.95, cloudA * detail * 1.6) * smoothstep(0.2, 0.6, cloudB);

    // Dust lanes: ridged noise, strongest along the band
    float ridge = 1.0 - abs(fbm(dir * 3.4 + vec3(n * 1.4)));
    float lanes = smoothstep(0.6, 0.97, ridge) * (0.35 + 0.65 * band);
    float rift = smoothstep(0.55, 0.9, 1.0 - abs(fbm(dir * 2.2 + 3.0))) * core;

    vec3 col = uBase;
    col = mix(col, uColorA, cloudA * uStrength);
    col = mix(col, uColorB, cloudB * uStrength * 0.75);
    col = mix(col, uColorC, cloudC * uStrength * 0.5);
    col += uMilky * band * (0.25 + 0.75 * detail) * 0.22 * (1.0 - uLight * 0.6);
    col += uMilky * core * detail * 0.18 * (1.0 - uLight);
    col += mix(uColorC, vec3(1.0, 0.85, 0.95), 0.4) * knots * 0.35 * (1.0 - uLight * 0.7);
    // Dust absorbs: darkens and reddens what is behind it
    float absorb = clamp(lanes * 0.8 + rift * 0.9, 0.0, 1.0) * mix(1.0, 0.35, uLight);
    col = mix(col, uDust, absorb);

    // Faint stars, denser in the band, hidden behind thick dust
    float s = stars(dir, 420.0, 0.012 + 0.03 * band) + stars(dir, 900.0, 0.02 + 0.05 * band) * 0.6;
    vec3 starTint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), hash(floor(dir * 420.0) + 3.3));
    col += starTint * s * (1.0 - absorb * 0.85) * (1.0 - uLight);

    // Glow around the sun
    float sun = max(dot(dir, uSun), 0.0);
    col += vec3(1.0, 0.9, 0.78) * (pow(sun, 48.0) * 0.5 + pow(sun, 6.0) * 0.06) * mix(1.0, 0.4, uLight);

    gl_FragColor = vec4(col, 1.0);
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
// B-spline (four bilinear taps) keeps the sky smooth.
const domeFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uSize;
  varying vec3 vDir;

  vec4 cubic(float v) {
    vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
    vec4 s = n * n * n;
    float x = s.x;
    float y = s.y - 4.0 * s.x;
    float z = s.z - 4.0 * s.y + 6.0 * s.x;
    return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
  }

  vec3 bicubic(vec2 uv) {
    uv = uv * uSize - 0.5;
    vec2 f = fract(uv);
    uv -= f;
    vec4 xc = cubic(f.x);
    vec4 yc = cubic(f.y);
    vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
    vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
    vec4 o = (c + vec4(xc.yw, yc.yw) / s) / uSize.xxyy;
    vec3 s0 = texture2D(uMap, o.xz).rgb;
    vec3 s1 = texture2D(uMap, o.yz).rgb;
    vec3 s2 = texture2D(uMap, o.xw).rgb;
    vec3 s3 = texture2D(uMap, o.yw).rgb;
    float sx = s.x / (s.x + s.y);
    float sy = s.z / (s.z + s.w);
    return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float lon = atan(dir.z, dir.x);
    float lat = asin(clamp(dir.y, -1.0, 1.0));
    vec2 uv = vec2(fract(lon / 6.2831853 + 0.5), lat / 3.1415926 + 0.5);
    gl_FragColor = vec4(bicubic(uv), 1.0);
  }
`;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Strips per bake: each is one frame's work, so no single draw stalls the GPU */
const strips = 8;

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
      uColorA: { value: new Color(palette.nebula[0]) },
      uColorB: { value: new Color(palette.nebula[1]) },
      uColorC: { value: new Color(palette.nebula[2]) },
      uDust: { value: new Color(theme === 'light' ? '#dcd6ec' : '#030308') },
      uMilky: { value: new Color(theme === 'light' ? '#ffffff' : '#c7c9ff') },
      uSun: { value: sunDirection },
      uGalactic: { value: galacticNormal },
    },
    defines: { OCTAVES: octaves },
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

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uMap: { value: target.texture },
          uSize: { value: new Vector2(target.width, target.height) },
        },
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    [target]
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
    },
    [material, target]
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
