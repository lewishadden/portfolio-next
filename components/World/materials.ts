import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  FrontSide,
  NormalBlending,
  ShaderMaterial,
} from 'three';

import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   GLSL chunks
   ------------------------------------------------------------------ */

/** Ashima 3D simplex noise + fbm */
export const noiseGlsl = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    value += amplitude * snoise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}
`;

const uvVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/* ------------------------------------------------------------------
   Theme switching — additive glows disappear on a light canvas,
   so light mode swaps to normal blending.
   ------------------------------------------------------------------ */
export function applyGlowTheme(material: ShaderMaterial, theme: WorldTheme) {
  if (material.uniforms.uLight) material.uniforms.uLight.value = theme === 'light' ? 1 : 0;
  if (!material.userData.glow) return;
  const blending = theme === 'light' ? NormalBlending : AdditiveBlending;
  if (material.blending !== blending) {
    material.blending = blending;
    material.needsUpdate = true;
  }
}

/** Marks a material as an additive glow so applyGlowTheme swaps its blending */
export function asGlow<T extends ShaderMaterial>(material: T) {
  material.userData.glow = true;
  return material;
}

/* ------------------------------------------------------------------
   Energy ring — gradient + travelling pulses, optional dashes.
   Designed for TorusGeometry / RingGeometry UVs (uv.x runs around).
   ------------------------------------------------------------------ */
export function createRingMaterial({
  colorA,
  colorB,
  intensity = 2.2,
  dashes = 0,
  speed = 0.08,
  opacity = 1,
}: {
  colorA: string;
  colorB: string;
  intensity?: number;
  dashes?: number;
  speed?: number;
  opacity?: number;
}) {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new Color(colorA) },
        uColorB: { value: new Color(colorB) },
        uIntensity: { value: intensity },
        uDashes: { value: dashes },
        uSpeed: { value: speed },
        uOpacity: { value: opacity },
        uLight: { value: 0 },
      },
      vertexShader: uvVertex,
      fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime, uIntensity, uDashes, uSpeed, uOpacity, uLight;
      uniform vec3 uColorA, uColorB;
      void main() {
        float a = vUv.x;
        vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * sin(a * 12.566 + uTime * 0.6));
        float pulse = pow(0.5 + 0.5 * sin((a - uTime * uSpeed) * 18.85), 10.0);
        float dash = uDashes > 0.0 ? step(0.42, fract(a * uDashes - uTime * uSpeed * 3.0)) : 1.0;
        float alpha = dash * uOpacity * (0.6 + pulse * 0.6);
        float glow = mix(uIntensity, 1.0, uLight);
        gl_FragColor = vec4(col * glow * (1.0 + pulse * 1.4 * (1.0 - uLight)), alpha);
      }
    `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
    })
  );
}

/* ------------------------------------------------------------------
   Fresnel rim — atmospheres, holographic shells
   ------------------------------------------------------------------ */
export function createFresnelMaterial({
  color,
  power = 2.6,
  intensity = 1.6,
  backSide = false,
}: {
  color: string;
  power?: number;
  intensity?: number;
  backSide?: boolean;
}) {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uPower: { value: power },
        uIntensity: { value: intensity },
        uLight: { value: 0 },
        uBackSide: { value: backSide ? 1 : 0 },
      },
      vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
      fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      uniform vec3 uColor;
      uniform float uPower, uIntensity, uLight;
      uniform float uBackSide;
      void main() {
        float facing = dot(normalize(vNormal), normalize(vView));
        // Front shells glow at the rim; back shells (halos) glow near the body and fade outward
        float f = uBackSide > 0.5
          ? pow(clamp(-facing, 0.0, 1.0), uPower)
          : pow(1.0 - abs(facing), uPower);
        gl_FragColor = vec4(uColor * mix(uIntensity, 1.0, uLight), f * mix(1.0, 0.7, uLight));
      }
    `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: backSide ? BackSide : FrontSide,
      toneMapped: false,
    })
  );
}

/* ------------------------------------------------------------------
   Beam — vertical energy flow for cylinders (uv.y runs along height)
   ------------------------------------------------------------------ */
export function createBeamMaterial({
  color,
  intensity = 2,
  opacity = 1,
  speed = 0.5,
}: {
  color: string;
  intensity?: number;
  opacity?: number;
  speed?: number;
}) {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(color) },
        uIntensity: { value: intensity },
        uOpacity: { value: opacity },
        uSpeed: { value: speed },
        uLight: { value: 0 },
      },
      vertexShader: uvVertex,
      fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uTime, uIntensity, uOpacity, uSpeed, uLight;
      void main() {
        float flow = 0.55 + 0.45 * sin(vUv.y * 90.0 + uTime * uSpeed * 12.0);
        float edge = sin(vUv.x * 3.14159);
        float fade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
        float alpha = uOpacity * flow * edge * fade;
        gl_FragColor = vec4(uColor * mix(uIntensity, 1.0, uLight), alpha);
      }
    `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
    })
  );
}

/* ------------------------------------------------------------------
   Halo — soft radial glow on a plane (billboard it in the component)
   ------------------------------------------------------------------ */
export function createHaloMaterial({
  color,
  intensity = 1,
  opacity = 1,
}: {
  color: string;
  intensity?: number;
  opacity?: number;
}) {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uIntensity: { value: intensity },
        uOpacity: { value: opacity },
        uLight: { value: 0 },
      },
      vertexShader: uvVertex,
      fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uIntensity, uOpacity, uLight;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float glow = pow(clamp(1.0 - d, 0.0, 1.0), 2.4);
        gl_FragColor = vec4(uColor * mix(uIntensity, 1.0, uLight), glow * uOpacity * mix(1.0, 0.55, uLight));
      }
    `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  );
}
