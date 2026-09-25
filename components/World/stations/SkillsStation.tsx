'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three';

import { loadIconBundle } from 'components/IconifyLoader/IconifyLoader';
import { asGlow, createFresnelMaterial, noiseGlsl } from '../materials';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { stationPositions } from '../stations';
import { setUniform } from '../utils';
import { worldStore } from '../worldStore';

import type { IconifyJSON } from '@iconify/react';
import type { WorldPalette, WorldTheme } from '../utils';

type SkillIcon = { name: string; icon: string; category: string };

const planetFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uLight;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  ${noiseGlsl}
  void main() {
    vec3 p = normalize(vPos);
    float warp = fbm(p * 2.2 + vec3(0.0, 0.0, uTime * 0.03));
    float bands = sin(p.y * 14.0 + warp * 3.2 + uTime * 0.05);
    float storm = smoothstep(0.55, 0.9, fbm(p * 4.0 + vec3(uTime * 0.02)));
    vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * bands);
    col = mix(col, uColorC, storm * 0.6);
    float light = clamp(dot(normalize(vNormal), normalize(vec3(-0.6, 0.5, 0.8))), 0.0, 1.0);
    col *= mix(0.25, 1.15, light);
    float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 3.0);
    col += uColorB * rim * mix(1.4, 0.6, uLight);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const planetVertex = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ringFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uLight;
  varying vec2 vUv;
  varying float vRadius;
  void main() {
    float r = vRadius;
    float bands = 0.5 + 0.5 * sin(r * 38.0) * sin(r * 11.0 + 1.3);
    float gap = smoothstep(0.52, 0.55, r) * (1.0 - smoothstep(0.6, 0.63, r));
    float edge = smoothstep(0.0, 0.08, r) * smoothstep(1.0, 0.85, r);
    float alpha = edge * (0.25 + bands * 0.55) * (1.0 - gap * 0.85);
    vec3 col = mix(uColorA, uColorB, r);
    gl_FragColor = vec4(col * mix(1.5, 1.0, uLight), alpha * mix(0.8, 0.7, uLight));
  }
`;

const ringVertex = /* glsl */ `
  uniform float uInner;
  uniform float uOuter;
  varying vec2 vUv;
  varying float vRadius;
  void main() {
    vUv = uv;
    vRadius = (length(position.xy) - uInner) / (uOuter - uInner);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringInner = 2.6;
const ringOuter = 3.9;

const buildMaterials = (p: WorldPalette) => ({
  planet: new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new Color(p.violet).multiplyScalar(0.55) },
      uColorB: { value: new Color(p.cyan) },
      uColorC: { value: new Color(p.pink) },
      uLight: { value: 0 },
    },
    defines: { OCTAVES: 4 },
    vertexShader: planetVertex,
    fragmentShader: planetFragment,
  }),
  atmosphere: createFresnelMaterial({ color: p.cyan, power: 2.2, intensity: 2.2 }),
  ring: asGlow(
    new ShaderMaterial({
      uniforms: {
        uColorA: { value: new Color(p.violet) },
        uColorB: { value: new Color(p.cyan) },
        uInner: { value: ringInner },
        uOuter: { value: ringOuter },
        uLight: { value: 0 },
      },
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    })
  ),
});

/** Renders an Iconify icon from the offline bundle into a glowing badge texture */
function drawBadge(svg: string | null, label: string, theme: WorldTheme) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  if (!ctx) return texture;

  const dark = theme === 'dark';
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, dark ? '#a78bfa' : '#7c3aed');
  gradient.addColorStop(1, dark ? '#22d3ee' : '#0e7490');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = dark ? 'rgba(12, 14, 32, 0.92)' : 'rgba(255, 255, 255, 0.95)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = gradient;
  ctx.stroke();

  const paintLabel = () => {
    ctx.fillStyle = dark ? '#e0e7ff' : '#312e81';
    ctx.font = '600 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.slice(0, 2).toUpperCase(), size / 2, size / 2 + 2);
    texture.needsUpdate = true;
  };

  if (!svg) {
    paintLabel();
    return texture;
  }
  const image = new Image();
  image.onload = () => {
    ctx.drawImage(image, size * 0.24, size * 0.24, size * 0.52, size * 0.52);
    texture.needsUpdate = true;
  };
  image.onerror = paintLabel;
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return texture;
}

function iconSvg(collections: IconifyJSON[], name: string, color: string) {
  const [prefix, iconName] = name.split(':');
  const collection = collections.find((c) => c.prefix === prefix);
  const resolved =
    collection?.icons[iconName] ?? collection?.icons[collection.aliases?.[iconName]?.parent ?? ''];
  if (!collection || !resolved) return null;
  const width = resolved.width ?? collection.width ?? 16;
  const height = resolved.height ?? collection.height ?? 16;
  const body = resolved.body.replace(/currentColor/g, color);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="${resolved.left ?? 0} ${resolved.top ?? 0} ${width} ${height}">${body}</svg>`;
}

function useIconCollections() {
  const [collections, setCollections] = useState<IconifyJSON[] | null>(null);
  useEffect(() => {
    let active = true;
    loadIconBundle().then((loaded) => {
      if (active) setCollections(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return collections;
}

function orbitGeometry(radius: number) {
  const points: number[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    points.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  return geometry;
}

const orbitTilts: [number, number][] = [
  [0.2, 0.1],
  [-0.25, 0.4],
  [0.4, -0.3],
  [-0.12, -0.55],
];

/** `/skills` — a gas giant with the toolkit orbiting as a constellation of badges */
export function SkillsStation({
  theme,
  skills,
  categories,
}: {
  theme: WorldTheme;
  skills: SkillIcon[];
  categories: string[];
}) {
  const groupRef = useRef<Group>(null);
  const planetRef = useRef<Group>(null);
  const orbitsRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme);
  const collections = useIconCollections();

  const orbits = useMemo(
    () =>
      categories.map((category, k) => {
        const members = skills.filter((s) => s.category === category);
        const radius = 3.9 + k * 0.5;
        return {
          category,
          members,
          radius,
          geometry: orbitGeometry(radius),
          tilt: orbitTilts[k % 4],
        };
      }),
    [categories, skills]
  );

  useEffect(() => () => orbits.forEach((orbit) => orbit.geometry.dispose()), [orbits]);

  const textures = useMemo(() => {
    if (!collections) return null;
    const monochrome = theme === 'dark' ? '#e0e7ff' : '#312e81';
    return orbits.map((orbit) =>
      orbit.members.map((skill) =>
        drawBadge(iconSvg(collections, skill.icon, monochrome), skill.name, theme)
      )
    );
  }, [collections, orbits, theme]);

  useEffect(
    () => () => textures?.forEach((set) => set.forEach((texture) => texture.dispose())),
    [textures]
  );

  useFrame(({ camera, clock }) => {
    if (!stationInRange(groupRef.current, camera, 'skills')) return;
    const t = clock.elapsedTime;
    setUniform(materials.planet, 'uTime', t);

    const planet = planetRef.current;
    if (planet) planet.rotation.y = t * 0.06;

    orbitsRef.current?.children.forEach((orbitGroup, k) => {
      const spinner = orbitGroup.children[1];
      if (spinner)
        spinner.rotation.y = t * (0.05 + k * 0.018) * (k % 2 ? -1 : 1) + worldStore.scroll * 0.8;
    });
  });

  return (
    <group ref={groupRef} position={stationPositions.skills}>
      <group ref={planetRef} rotation={[0.3, 0, 0.2]}>
        <mesh material={materials.planet}>
          <sphereGeometry args={[1.9, 96, 64]} />
        </mesh>
        <mesh material={materials.atmosphere} scale={1.12}>
          <sphereGeometry args={[1.9, 64, 32]} />
        </mesh>
        <mesh material={materials.ring} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
          <ringGeometry args={[ringInner, ringOuter, 160, 1]} />
        </mesh>
      </group>

      <group ref={orbitsRef}>
        {orbits.map((orbit, k) => (
          <group key={orbit.category} rotation={[orbit.tilt[0], 0, orbit.tilt[1]]}>
            <lineLoop geometry={orbit.geometry}>
              <lineBasicMaterial
                color={theme === 'dark' ? '#8b5cf6' : '#6d28d9'}
                transparent
                opacity={theme === 'dark' ? 0.3 : 0.25}
              />
            </lineLoop>
            {/* Sprites mount only once their badge textures exist: a material compiled
                without a map would not pick one up later */}
            <group>
              {textures?.[k]?.map((texture, i) => {
                const angle = (i / orbit.members.length) * Math.PI * 2 + k;
                return (
                  <sprite
                    key={orbit.members[i].name}
                    position={[Math.cos(angle) * orbit.radius, 0, Math.sin(angle) * orbit.radius]}
                    scale={0.44}
                  >
                    <spriteMaterial
                      map={texture}
                      transparent
                      depthWrite={false}
                      toneMapped={false}
                    />
                  </sprite>
                );
              })}
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}
