'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  Color,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
} from 'three';

import { noiseGlsl } from './materials';
import { palettes, setUniform } from './utils';

import type { WebGLRenderer } from 'three';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Bake pass: fbm clouds rendered once into an equirectangular texture.
   The sky dome then samples it, so the per-frame cost is a texture read
   instead of a dozen noise evaluations per pixel.
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
  varying vec2 vUv;
  ${noiseGlsl}
  void main() {
    float lon = (vUv.x - 0.5) * 6.2831853;
    float lat = (vUv.y - 0.5) * 3.1415926;
    vec3 dir = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
    float n1 = fbm(dir * 1.6 + vec3(0.3, 0.0, -0.2));
    float n2 = fbm(dir * 2.4 + vec3(4.0, 0.7, 1.3));
    float n3 = fbm(dir * 3.2 - vec3(2.0, 1.0, 0.5));
    float cloudA = smoothstep(-0.05, 0.75, n1);
    float cloudB = smoothstep(0.0, 0.8, n2) * (1.0 - cloudA * 0.5);
    float cloudC = smoothstep(0.25, 0.9, n3) * 0.7;
    vec3 col = uBase;
    col = mix(col, uColorA, cloudA * uStrength);
    col = mix(col, uColorB, cloudB * uStrength * 0.8);
    col = mix(col, uColorC, cloudC * uStrength * 0.55);
    float filament = pow(max(0.0, 1.0 - abs(n2) * 3.0), 6.0) * (1.0 - uLight);
    col += uColorB * filament * 0.18;
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

const domeFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float lon = atan(dir.z, dir.x) + uTime * 0.004;
    float lat = asin(clamp(dir.y, -1.0, 1.0));
    vec2 uv = vec2(fract(lon / 6.2831853 + 0.5), lat / 3.1415926 + 0.5);
    gl_FragColor = vec4(texture2D(uMap, uv).rgb, 1.0);
  }
`;

function bakeNebula(
  renderer: WebGLRenderer,
  target: WebGLRenderTarget,
  theme: WorldTheme,
  octaves: number
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

  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, new OrthographicCamera(-1, 1, 1, -1, 0, 1));
  renderer.setRenderTarget(previous);

  geometry.dispose();
  material.dispose();
}

/** Procedural nebula dome that always sits around the camera (effectively at infinity) */
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

  const target = useMemo(() => {
    // Half-float keeps the dark, linear-space gradients free of banding
    return new WebGLRenderTarget(size, size / 2, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
    });
  }, [size]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uMap: { value: target.texture }, uTime: { value: 0 } },
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    [target]
  );

  useEffect(() => bakeNebula(gl, target, theme, octaves), [gl, target, theme, octaves]);

  useEffect(
    () => () => {
      material.dispose();
      target.dispose();
    },
    [material, target]
  );

  useFrame(({ camera, clock }) => {
    meshRef.current?.position.copy(camera.position);
    setUniform(material, 'uTime', clock.elapsedTime);
  });

  return (
    <mesh ref={meshRef} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[900, 48, 32]} />
    </mesh>
  );
}
