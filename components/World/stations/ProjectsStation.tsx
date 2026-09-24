'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, Group, ShaderMaterial, SRGBColorSpace, TextureLoader } from 'three';

import { createHaloMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { stationModels, stationPositions } from '../stations';
import { palettes, setUniform } from '../utils';
import { worldStore } from '../worldStore';

import type { Texture } from 'three';
import type { WorldPalette, WorldTheme } from '../utils';

const maxScreens = 12;
const helixRadius = 5.4;

const screenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const screenFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uTime;
  uniform float uReveal;
  uniform vec3 uEdge;
  uniform vec3 uTint;
  uniform float uAspect;
  varying vec2 vUv;
  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float d = roundedBox(p, vec2(uAspect, 1.0) * 0.5, 0.06);
    if (d > 0.0) discard;
    vec3 img = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb : mix(uTint * 0.25, uTint * 0.6, vUv.y);
    float scan = 0.94 + 0.06 * sin(vUv.y * 420.0 - uTime * 6.0);
    float sweep = smoothstep(0.0, 0.08, abs(vUv.y - fract(uTime * 0.12)));
    vec3 col = img * scan * mix(1.25, 1.0, sweep);
    float edge = smoothstep(-0.03, 0.0, d);
    col = mix(col, uEdge * 2.4, edge);
    float reveal = smoothstep(uReveal - 0.1, uReveal, 1.0 - vUv.y);
    gl_FragColor = vec4(col, (1.0 - reveal) * 0.96);
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
      uHasMap: { value: 0 },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uEdge: { value: new Color(edge) },
      uTint: { value: new Color(tint) },
      uAspect: { value: 1.6 },
    },
    vertexShader: screenVertex,
    fragmentShader: screenFragment,
    transparent: true,
    side: DoubleSide,
    toneMapped: false,
  });
}

function attachTexture(material: ShaderMaterial, texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  setUniform(material, 'uMap', texture);
  setUniform(material, 'uHasMap', 1);
}

/** Optimised (and cached) through the Next.js image endpoint */
const optimisedImage = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`;

/** `/projects` — the terminal inside a slowly turning helix of project screens */
export function ProjectsStation({
  theme,
  projects,
}: {
  theme: WorldTheme;
  projects: { title: string; image?: string }[];
}) {
  const groupRef = useRef<Group>(null);
  const helixRef = useRef<Group>(null);
  const terminalRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme);
  const palette = palettes[theme];

  const screens = useMemo(() => projects.slice(0, maxScreens), [projects]);

  const screenMaterials = useMemo(
    () =>
      screens.map((_, i) =>
        createScreenMaterial(i % 2 ? palette.cyan : palette.violet, i % 2 ? '#0e7490' : '#6d28d9')
      ),
    [screens, palette.cyan, palette.violet]
  );

  useEffect(() => {
    const loader = new TextureLoader();
    const textures: Texture[] = [];
    let cancelled = false;
    screens.forEach((screen, i) => {
      if (!screen.image) return;
      loader.load(optimisedImage(screen.image), (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        textures.push(texture);
        attachTexture(screenMaterials[i], texture);
      });
    });
    return () => {
      cancelled = true;
      textures.forEach((texture) => texture.dispose());
      screenMaterials.forEach((material) => material.dispose());
    };
  }, [screens, screenMaterials]);

  useFrame(({ camera, clock }, delta) => {
    if (!stationInRange(groupRef.current, camera, 'projects')) return;
    const t = clock.elapsedTime;
    setUniform(materials.base, 'uTime', t);
    screenMaterials.forEach((material, i) => {
      setUniform(material, 'uTime', t + i);
      const reveal = material.uniforms.uReveal.value as number;
      if (reveal < 1.1) setUniform(material, 'uReveal', reveal + Math.min(delta, 0.05) * 0.8);
    });

    const helix = helixRef.current;
    if (helix) {
      helix.rotation.y = t * 0.035 + worldStore.scroll * 1.2;
      // Screens orbit with the helix but always turn to face the viewer
      helix.children.forEach((screen) => screen.lookAt(camera.position));
    }

    const terminal = terminalRef.current;
    if (terminal) {
      terminal.position.y = Math.sin(t * 0.8) * 0.12;
      terminal.rotation.y = 0.3 + Math.sin(t * 0.3) * 0.25 + worldStore.pointerX * 0.3;
    }
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
          const angle = i * 0.78;
          return (
            <group
              key={screen.title}
              position={[
                Math.sin(angle) * helixRadius,
                2.4 - i * 1.05,
                Math.cos(angle) * helixRadius,
              ]}
            >
              <mesh material={screenMaterials[i]} scale={[2.08, 1.3, 1]}>
                <planeGeometry />
              </mesh>
            </group>
          );
        })}
      </group>

      <group ref={terminalRef}>
        <Model url={stationModels.projects!} height={2.6} theme={theme} />
      </group>
    </group>
  );
}
