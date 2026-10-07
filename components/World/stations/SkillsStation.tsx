'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  MathUtils,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  NormalBlending,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';

import { iconSvg, useIconCollections } from '../icons';
import { asGlow, createFresnelMaterial, noiseGlsl } from '../materials';
import { NavLights, SolarArray, Spin } from '../parts';
import { spawnPing } from '../Pings';
import { StationScope } from '../power';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { stationPositions } from '../stations';
import { StationHull } from '../StationHull';
import { setUniform } from '../utils';
import { focusOnPage, setWorldHover, worldStore, worldTip } from '../worldStore';

import type { Camera, LineSegments, Object3D, Sprite, SpriteMaterial } from 'three';
import type { NavLight } from '../parts';
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
    // Clamped: a head-on dot can round past 1, and pow() of a negative base is NaN
    float rim = pow(clamp(1.0 - dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 3.0);
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

const outpostLights: NavLight[] = [
  { position: [0, 1.05, 0], kind: 'white' },
  { position: [-0.9, 0, 0], kind: 'red' },
  { position: [0.9, 0, 0], kind: 'green' },
];

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

/**
 * A category's constellation: lines from each badge to the one two along
 * (a star polygon, round the same circle the badges sit on), in the
 * badges' own frame so it turns with them
 */
function constellationGeometry(count: number, radius: number, offset: number) {
  const points: number[] = [];
  const at = (i: number) => {
    const angle = (i / count) * Math.PI * 2 + offset;
    return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
  };
  const step = count > 4 ? 2 : 1;
  for (let i = 0; i < count; i++) points.push(...at(i), ...at((i + step) % count));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  return geometry;
}

const badgePoint = new Vector3();

/**
 * How visible a badge should be where it is on screen: faded right down
 * while it sits behind the page's heading block (worldStore.copy), so the
 * constellation never draws through the copy
 */
function clearOfCopy(badge: Object3D, camera: Camera) {
  const copy = worldStore.copy;
  if (copy.right <= copy.left) return 1;
  badge.getWorldPosition(badgePoint).project(camera);
  const margin = 0.06;
  const dx = Math.max(copy.left - margin - badgePoint.x, badgePoint.x - copy.right - margin, 0);
  const dy = Math.max(copy.bottom - margin - badgePoint.y, badgePoint.y - copy.top - margin, 0);
  return MathUtils.lerp(0.1, 1, MathUtils.smoothstep(Math.hypot(dx, dy), 0, 0.08));
}

/**
 * The badges respond to the page as well as the pointer: the skill a tile
 * is hovered or focused for (worldStore.skillHover) swells like a hovered
 * badge, the category being read (worldStore.skillCategory) stays bright
 * while the rest dim, and its constellation lights up
 */
function stepOrbit(
  orbitGroup: Object3D,
  category: string,
  hovered: string | null,
  camera: Camera,
  t: number,
  dt: number
) {
  const [line, spinner] = orbitGroup.children as [Object3D, Object3D];
  if (!spinner) return;
  const reading = worldStore.skillCategory;
  const named = hovered ?? worldStore.skillHover;
  let lit = reading === category ? 1 : 0;
  for (const child of spinner.children) {
    if (!(child as Sprite).isSprite) continue;
    const badge = child as Sprite;
    const pointed = badge.name === named;
    if (pointed) lit = 1;
    // The hovered badge swells
    const size = MathUtils.damp(badge.scale.x, pointed ? 0.7 : 0.44, 10, dt);
    badge.scale.set(size, size, 1);
    const material = badge.material as SpriteMaterial;
    const dim = reading && reading !== category && !pointed ? 0.35 : 1;
    material.opacity = MathUtils.damp(material.opacity, dim * clearOfCopy(badge, camera), 8, dt);
  }
  const constellation = spinner.children.find((child) => (child as LineSegments).isLineSegments);
  if (constellation) {
    const material = (constellation as LineSegments).material as LineBasicMaterial;
    const target = lit * (0.55 + 0.15 * Math.sin(t * 3));
    material.opacity = MathUtils.damp(material.opacity, target, 6, dt);
    constellation.visible = material.opacity > 0.01;
  }
  const orbitLine = (line as LineSegments).material as LineBasicMaterial;
  orbitLine.opacity = MathUtils.damp(orbitLine.opacity, orbitLine.userData.base * (1 + lit), 6, dt);
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
  const outpostRef = useRef<Group>(null);
  const hoveredRef = useRef<string | null>(null);
  const materials = useThemedMaterials(buildMaterials, theme, 'skills');
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
          constellation: constellationGeometry(Math.max(members.length, 1), radius, k),
          tilt: orbitTilts[k % 4],
        };
      }),
    [categories, skills]
  );

  useEffect(
    () => () =>
      orbits.forEach((orbit) => {
        orbit.geometry.dispose();
        orbit.constellation.dispose();
      }),
    [orbits]
  );

  const lines = useMemo(() => {
    const dark = theme === 'dark';
    const orbit = new LineBasicMaterial({
      color: dark ? '#8b5cf6' : '#6d28d9',
      transparent: true,
      opacity: dark ? 0.3 : 0.25,
    });
    orbit.userData.base = orbit.opacity;
    return {
      orbits: orbits.map(() => orbit.clone()),
      constellations: orbits.map(
        () =>
          new LineBasicMaterial({
            color: dark ? '#67e8f9' : '#0e7490',
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: dark ? AdditiveBlending : NormalBlending,
          })
      ),
    };
  }, [orbits, theme]);
  useEffect(
    () => () => {
      lines.orbits.forEach((material) => material.dispose());
      lines.constellations.forEach((material) => material.dispose());
    },
    [lines]
  );

  // One stable tooltip per skill (the tooltip store compares by identity)
  const tips = useMemo(
    () =>
      new Map(
        skills.map((skill) => [
          skill.name,
          {
            label: skill.name,
            sub: `${skill.category[0].toUpperCase()}${skill.category.slice(1)} · click to find it`,
          },
        ])
      ),
    [skills]
  );

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

  useFrame(({ camera, clock }, delta) => {
    if (!stationInRange(groupRef.current, camera, 'skills')) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    setUniform(materials.planet, 'uTime', t);

    const planet = planetRef.current;
    if (planet) planet.rotation.y = t * 0.06;
    // The research outpost keeps a slow, wide orbit around the giant
    if (outpostRef.current) outpostRef.current.rotation.y = -0.9 + t * 0.045;

    orbitsRef.current?.children.forEach((orbitGroup, k) => {
      const spinner = orbitGroup.children[1];
      if (!spinner) return;
      spinner.rotation.y = t * (0.05 + k * 0.018) * (k % 2 ? -1 : 1) + worldStore.scroll * 0.8;
      stepOrbit(orbitGroup, orbits[k].category, hoveredRef.current, camera, t, dt);
    });
  });

  return (
    <StationScope station="skills">
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

        <group rotation={[0.32, 0, -0.18]}>
          <group ref={outpostRef}>
            <group position={[7.4, 0.6, 0]} rotation={[0, Math.PI / 2.4, 0.1]}>
              <Spin speed={0.2}>
                <StationHull station="skills" height={1.9} theme={theme} />
                <SolarArray position={[0.35, 0, -0.1]} length={2} width={0.6} panels={2} />
                <SolarArray
                  position={[-0.35, 0, -0.1]}
                  rotation={[0, Math.PI, 0]}
                  length={2}
                  width={0.6}
                  panels={2}
                />
                <NavLights lights={outpostLights} size={0.035} />
              </Spin>
            </group>
          </group>
        </group>

        <group ref={orbitsRef}>
          {orbits.map((orbit, k) => (
            <group key={orbit.category} rotation={[orbit.tilt[0], 0, orbit.tilt[1]]}>
              <lineLoop geometry={orbit.geometry} material={lines.orbits[k]} />
              {/* Sprites mount only once their badge textures exist: a material compiled
                without a map would not pick one up later */}
              <group>
                <lineSegments
                  geometry={orbit.constellation}
                  material={lines.constellations[k]}
                  visible={false}
                />
                {textures?.[k]?.map((texture, i) => {
                  const angle = (i / orbit.members.length) * Math.PI * 2 + k;
                  return (
                    <sprite
                      key={orbit.members[i].name}
                      name={orbit.members[i].name}
                      position={[Math.cos(angle) * orbit.radius, 0, Math.sin(angle) * orbit.radius]}
                      scale={0.44}
                      onPointerOver={(e) => {
                        e.stopPropagation();
                        const name = orbit.members[i].name;
                        if (hoveredRef.current === name) return;
                        if (hoveredRef.current) setWorldHover(false);
                        hoveredRef.current = name;
                        setWorldHover(true);
                        worldTip.set(tips.get(name) ?? null);
                      }}
                      onPointerOut={() => {
                        const name = orbit.members[i].name;
                        if (hoveredRef.current !== name) return;
                        hoveredRef.current = null;
                        setWorldHover(false);
                        if (worldTip.get() === tips.get(name)) worldTip.set(null);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        spawnPing(e.point);
                        focusOnPage(`skill:${orbit.members[i].name}`);
                      }}
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
    </StationScope>
  );
}
