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
  Vector3,
} from 'three';

import { createHaloMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { stationInRange, useThemedMaterials, useWide } from '../stationHooks';
import { stationModels, stationPositions } from '../stations';
import { palettes, setUniform } from '../utils';
import { worldStore } from '../worldStore';

import type { Texture } from 'three';
import type { WorldPalette, WorldTheme } from '../utils';

const maxScreens = 15;
const helixRadius = 5.4;
/** Angle and height step between consecutive screens on the helix */
const screenTurn = 0.78;
const screenRise = 1.05;
const screenTop = 2.4;
const focusScale = 1.3;

const toCamera = new Vector3();
const screenY = (i: number) => screenTop - i * screenRise;
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
  uniform float uHasMap;
  uniform float uTime;
  uniform float uReveal;
  uniform vec3 uEdge;
  uniform vec3 uTint;
  uniform float uAspect;
  uniform float uDim;
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
      uHasMap: { value: 0 },
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

function attachTexture(material: ShaderMaterial, texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  setUniform(material, 'uMap', texture);
  setUniform(material, 'uHasMap', 1);
}

/** Optimised (and cached) through the Next.js image endpoint */
const optimisedImage = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`;

/**
 * `/projects` — the terminal inside a slowly turning helix of project screens.
 * With a `focus` (a project page or modal is open) the helix turns and rises
 * to bring that project's screen in front of the camera, enlarged, while the
 * rest dim.
 */
export function ProjectsStation({
  theme,
  projects,
  focus = -1,
}: {
  theme: WorldTheme;
  projects: { title: string; image?: string }[];
  focus?: number;
}) {
  // On-demand rendering (reduced motion) snaps instead of easing
  const snap = useThree((s) => s.frameloop === 'demand');
  const wide = useWide();
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

  const settled = useRef(false);
  const focused = focus >= 0 && focus < screens.length ? focus : -1;

  useFrame(({ camera, clock }, delta) => {
    const group = groupRef.current;
    if (!stationInRange(group, camera, 'projects')) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const instant = snap || !settled.current;
    settled.current = true;
    setUniform(materials.base, 'uTime', t);
    screenMaterials.forEach((material, i) => {
      setUniform(material, 'uTime', t + i);
      const reveal = material.uniforms.uReveal.value as number;
      if (reveal < 1.1) setUniform(material, 'uReveal', snap ? 1.1 : reveal + dt * 0.8);
      const dim = focused >= 0 && i !== focused ? 1 : 0;
      const current = material.uniforms.uDim.value as number;
      setUniform(material, 'uDim', instant ? dim : approach(current, dim, 4, dt));
    });

    const helix = helixRef.current;
    if (helix && group) {
      let angle = t * 0.035 + worldStore.scroll * 1.2;
      let lift = 0;
      if (focused >= 0) {
        // Turn the screen onto the line between the camera and the helix axis,
        // and raise it to the height the camera frames the station at
        // (see stationCamera: look sits 0.8 below the eye, narrow shifts it 2.5 down)
        toCamera.subVectors(camera.position, group.position);
        angle = Math.atan2(toCamera.x, toCamera.z) - focused * screenTurn;
        lift = toCamera.y - 0.8 + (wide ? 0 : 2.5) - screenY(focused);
      }
      // Always take the short way round
      angle = helix.rotation.y + angleDelta(helix.rotation.y, angle);
      if (instant) {
        helix.rotation.y = angle;
        helix.position.y = lift;
      } else {
        easing.damp(helix.rotation, 'y', angle, 0.5, dt);
        easing.damp(helix.position, 'y', lift, 0.5, dt);
      }

      helix.children.forEach((screen, i) => {
        const scale = i === focused ? focusScale : 1;
        if (instant) screen.scale.setScalar(scale);
        else easing.damp3(screen.scale, scale, 0.35, dt);
        // Screens orbit with the helix but always turn to face the viewer
        screen.lookAt(camera.position);
      });
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
          const angle = i * screenTurn;
          return (
            <group
              key={screen.title}
              position={[Math.sin(angle) * helixRadius, screenY(i), Math.cos(angle) * helixRadius]}
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
