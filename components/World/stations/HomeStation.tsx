'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import {
  CanvasTexture,
  Color,
  DataTexture,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';

import { scrambleGlyphs } from 'components/Motion/ScrambleText';

import { ambientTime } from '../clock';
import { asGlow, createHaloMaterial, createRingMaterial, noiseGlsl } from '../materials';
import { Model } from '../Model';
import { skyMap } from '../Nebula';
import { Antenna, NavLights, SolarArray } from '../parts';
import { StationScope } from '../power';
import {
  createReaction,
  easeInOut,
  stepReaction,
  trickProgress,
  useReactionHandlers,
  useShowcase,
} from '../reaction';
import { cssFontFamily, patchFontsReady } from '../patches';
import { Shards } from '../Shards';
import { StationHull } from '../StationHull';
import { stationInRange, useThemedMaterials, useWide } from '../stationHooks';
import { stationNames } from '../routes';
import { stationModels, stationPositions } from '../stations';
import { setUniform } from '../utils';
import { queueUpload } from '../warmup';
import { worldStore } from '../worldStore';

import type { Texture, WebGLRenderer } from 'three';
import type { NavLight } from '../parts';
import type { WorldPalette, WorldTheme } from '../utils';

const astronautTip = { label: 'Hello from Peterborough 👋', sub: 'Click for a barrel roll' };

const hubLights: NavLight[] = [
  // Wing tips (port red, starboard green), mast and keel strobes, hull accents
  { position: [-11.3, 0.5, 0], kind: 'red' },
  { position: [11.3, 0.5, 0], kind: 'green' },
  { position: [0.5, 6.35, 0.4], kind: 'white' },
  { position: [0, -3.7, 0], kind: 'white', phase: 0.8 },
  { position: [2.1, 1.8, 2.3], kind: 'cyan' },
  { position: [-2.2, -1.2, 2.4], kind: 'violet' },
];

/** Seconds the astronaut's barrel roll takes (the portal ripples with it) */
const rollTime = 1.2;

/**
 * The portal's surface: a slow whirl of light with a dark eye, and through
 * it the real sky (the baked dome, shared by Nebula), bent round the middle
 * the way a mass bends light. A click on the astronaut sends a ripple out
 * across it. Normal blending, so it reads as a window rather than a glow.
 */
function createPortalMaterial(p: WorldPalette) {
  return new ShaderMaterial({
    defines: { OCTAVES: 3 },
    uniforms: {
      uSky: skyMap,
      uTime: { value: 0 },
      uRipple: { value: 0 },
      uColorA: { value: new Color(p.violet) },
      uColorB: { value: new Color(p.cyan) },
      uLight: { value: 0 },
      uCharge: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vRight;
      varying vec3 vUp;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vRight = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
        vUp = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      ${noiseGlsl}
      uniform sampler2D uSky;
      uniform float uTime, uRipple, uLight, uCharge;
      uniform vec3 uColorA, uColorB;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vRight;
      varying vec3 vUp;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        // A ripple running out from the middle after a click
        float front = r - uRipple * 1.25;
        float wave = uRipple > 0.0
          ? sin(front * 28.0) * exp(-front * front * 30.0) * (1.0 - uRipple)
          : 0.0;
        // The whirl: inner rings turn faster
        float a = atan(p.y, p.x) + 1.4 / (r + 0.3) + uTime * 0.35;
        vec2 q = vec2(cos(a), sin(a)) * (r + wave * 0.06);
        float n = fbm(vec3(q * 2.4, uTime * 0.07));
        float arms = 0.5 + 0.5 * sin(a * 3.0 + n * 3.0);
        // The sky behind it, bent towards the middle, sampled as the dome is
        vec3 view = normalize(vWorld - cameraPosition);
        vec3 dir = normalize(view - (vRight * q.x + vUp * q.y) * (0.22 / (r + 0.25)));
        float lon = atan(dir.z, dir.x);
        float lat = asin(clamp(dir.y, -1.0, 1.0));
        vec3 sky = texture2D(uSky, vec2(fract(lon / 6.2831853 + 0.5), lat / 3.1415926 + 0.5)).rgb;
        vec3 swirl = mix(uColorA, uColorB, arms) * (0.2 + 0.55 * (1.0 - r) * (1.0 - r)) * (0.5 + n);
        vec3 col = sky * mix(1.6, 1.0, uLight) + swirl * mix(1.0, 0.6, uLight);
        // A dark eye in the middle, a bright lip where it meets the ring
        col *= mix(0.12, 1.0, smoothstep(0.0, 0.32, r));
        col += uColorB * (pow(r, 9.0) * 1.1 + abs(wave) * 1.6);
        float alpha = smoothstep(1.0, 0.9, r) * mix(0.9, 0.75, uLight) * min(uCharge, 1.0);
        gl_FragColor = vec4(col * max(uCharge, 1.0), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/* ------------------------------------------------------------------
   The portal's lettered ring: on wide layouts the dashed ring round the
   portal spells the hero's role line (worldStore.heroRole) clockwise in
   capitals, decoding as the page's line decodes. One instanced draw of
   glyph quads placed round the ring in the vertex shader, lettered from
   a small atlas of Geist Mono capitals and the decode's glyphs, drawn
   once the page's fonts are in and uploaded once.
   ------------------------------------------------------------------ */

/** Letters round the ring, and its radius (the dashed ring's) */
const ringSlots = 72;
const ringRadius = 3.25;
/** What the atlas can letter (anything else shows as a space) */
const glyphSet = [...new Set(`ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ·-/&.,'${scrambleGlyphs}`)].join(
  ''
);
/** Atlas cells per side, and pixels per cell */
const atlasCells = 8;
const cellSize = 64;
const space = glyphSet.indexOf(' ');
/** Spelled while there is no role line yet (the tour, free roam before a visit home) */
const ringFallback = stationNames.home.craft;

/** Stands in for the glyph atlas until it is drawn (nothing shows: no ink) */
const noGlyphs = new DataTexture(new Uint8Array(4), 1, 1);
noGlyphs.needsUpdate = true;

let glyphAtlas: Promise<Texture> | null = null;

/** The glyph atlas, drawn once the page's fonts are in and uploaded once for the page's life */
function loadGlyphAtlas(gl: WebGLRenderer) {
  glyphAtlas ??= patchFontsReady().then(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = atlasCells * cellSize;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `500 ${cellSize * 0.72}px ${cssFontFamily('--font-mono', 'monospace')}`;
      [...glyphSet].forEach((glyph, i) => {
        const x = (i % atlasCells) * cellSize + cellSize / 2;
        const y = Math.floor(i / atlasCells) * cellSize + cellSize / 2;
        ctx.fillText(glyph, x, y);
      });
    }
    const texture = new CanvasTexture(canvas);
    await queueUpload(gl, texture);
    return texture;
  });
  return glyphAtlas;
}

/**
 * Lays a role line out round the ring: as many whole repeats as fit, each
 * followed by a dot and an even share of the spare slots, so the seam never
 * cuts a word. Writes atlas cell indexes into `out`
 */
function layOutRing(text: string, out: Float32Array) {
  const unit = `${text.toUpperCase()} · `;
  const repeats = Math.max(1, Math.floor(ringSlots / unit.length));
  const spare = Math.max(0, ringSlots - repeats * unit.length);
  let slot = 0;
  for (let r = 0; r < repeats && slot < ringSlots; r++) {
    for (const glyph of unit) {
      if (slot >= ringSlots) break;
      const index = glyphSet.indexOf(glyph);
      out[slot++] = index < 0 ? space : index;
    }
    const gap = Math.floor(spare / repeats) + (r < spare % repeats ? 1 : 0);
    for (let g = 0; g < gap && slot < ringSlots; g++) out[slot++] = space;
  }
  while (slot < ringSlots) out[slot++] = space;
}

function createGlyphGeometry() {
  const plane = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute('position', plane.getAttribute('position'));
  geometry.setAttribute('uv', plane.getAttribute('uv'));
  geometry.setAttribute(
    'aSlot',
    new InstancedBufferAttribute(
      Float32Array.from({ length: ringSlots }, (_, i) => i),
      1
    )
  );
  const glyphs = new Float32Array(ringSlots);
  layOutRing(ringFallback, glyphs);
  geometry.setAttribute('aGlyph', new InstancedBufferAttribute(glyphs, 1));
  geometry.instanceCount = ringSlots;
  return geometry;
}

/** What the ring last spelled, so its glyphs are only rewritten when the line changes */
const ringText = { current: '' };

function spellRing(geometry: InstancedBufferGeometry) {
  const text = worldStore.heroRole || ringText.current || ringFallback;
  if (text === ringText.current) return;
  ringText.current = text;
  const attribute = geometry.getAttribute('aGlyph') as InstancedBufferAttribute;
  layOutRing(text, attribute.array as Float32Array);
  attribute.needsUpdate = true;
}

function createGlyphMaterial(p: WorldPalette) {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uAtlas: { value: noGlyphs },
        uColorA: { value: new Color(p.cyan) },
        uColorB: { value: new Color(p.pink) },
        uTime: { value: 0 },
        uIntensity: { value: 1.8 },
        uOpacity: { value: 0.85 },
        uLight: { value: 0 },
        uCharge: { value: 1 },
      },
      defines: {
        SLOTS: ringSlots.toFixed(1),
        RADIUS: ringRadius.toFixed(2),
        CELLS: atlasCells.toFixed(1),
      },
      vertexShader: /* glsl */ `
        attribute float aSlot;
        attribute float aGlyph;
        varying vec2 vUv;
        varying float vAlong;
        void main() {
          // Clockwise from the top, each letter standing out from the centre
          float angle = 1.5707963 - aSlot / SLOTS * 6.2831853;
          vec2 radial = vec2(cos(angle), sin(angle));
          vec2 along = vec2(radial.y, -radial.x);
          float pitch = 6.2831853 * RADIUS / SLOTS;
          vec2 local = position.xy * vec2(pitch * 1.1, pitch * 1.45);
          vec3 placed = vec3(radial * RADIUS + along * local.x + radial * local.y, 0.0);
          float column = mod(aGlyph, CELLS);
          float row = floor(aGlyph / CELLS);
          // The atlas's first row is at its top, where the texture's v is 1
          vUv = vec2((column + uv.x) / CELLS, 1.0 - (row + 1.0 - uv.y) / CELLS);
          vAlong = aSlot / SLOTS;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(placed, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uAtlas;
        uniform vec3 uColorA, uColorB;
        uniform float uTime, uIntensity, uOpacity, uLight, uCharge;
        varying vec2 vUv;
        varying float vAlong;
        void main() {
          float ink = texture2D(uAtlas, vUv).a;
          if (ink < 0.02) discard;
          vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vAlong * 12.566 + uTime * 0.6));
          float glow = mix(uIntensity, 1.0, uLight) * max(uCharge, 1.0);
          gl_FragColor = vec4(col * glow, ink * uOpacity * min(uCharge, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
  );
}

const buildMaterials = (p: WorldPalette) => ({
  portal: createRingMaterial({ colorA: p.violet, colorB: p.cyan, intensity: 2.6, speed: 0.06 }),
  surface: createPortalMaterial(p),
  orbit: createRingMaterial({
    colorA: p.cyan,
    colorB: p.pink,
    intensity: 1.8,
    dashes: 64,
    speed: 0.03,
    opacity: 0.75,
  }),
  outer: createRingMaterial({
    colorA: p.violet,
    colorB: p.violet,
    intensity: 1.2,
    dashes: 140,
    speed: -0.015,
    opacity: 0.45,
  }),
  halo: createHaloMaterial({ color: p.violet, intensity: 1.3, opacity: 0.6 }),
  haloCyan: createHaloMaterial({ color: p.cyan, intensity: 1, opacity: 0.35 }),
  glyphs: createGlyphMaterial(p),
});

/** `/` — astronaut coder floating in front of an energy portal */
export function HomeStation({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const floatRef = useRef<Group>(null);
  const portalRef = useRef<Mesh>(null);
  const orbitRef = useRef<Group>(null);
  const outerRef = useRef<Mesh>(null);
  const hubRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme, 'home');
  const reaction = useRef(createReaction());
  const handlers = useReactionHandlers(reaction, astronautTip, rollTime);
  useShowcase('home', floatRef, reaction, rollTime);

  // Wide layouts letter the dashed ring with the role line; narrow ones keep the dashes
  const wide = useWide();
  const still = useThree((s) => s.frameloop === 'demand');
  const gl = useThree((s) => s.gl);
  const [atlas, setAtlas] = useState<Texture | null>(null);
  useEffect(() => {
    let alive = true;
    loadGlyphAtlas(gl).then(
      (texture) => alive && setAtlas(texture),
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, [gl]);
  useEffect(() => setUniform(materials.glyphs, 'uAtlas', atlas ?? noGlyphs), [materials, atlas]);
  const glyphGeometry = useMemo(() => createGlyphGeometry(), []);
  useEffect(() => {
    // Spelled afresh by a new mount
    ringText.current = '';
    return () => glyphGeometry.dispose();
  }, [glyphGeometry]);
  const lettered = wide && atlas !== null;

  useFrame((state, delta) => {
    // Clicks and hovers are timed by the clock, idle motion by ambient time.
    // The click's stamp is stepped even out of range (see stepReaction)
    const t = state.clock.elapsedTime;
    const r = reaction.current;
    stepReaction(r, t, Math.min(delta, 0.05));
    if (!stationInRange(groupRef.current, state.camera, 'home')) return;
    const ambient = ambientTime(state);
    setUniform(materials.portal, 'uTime', ambient);
    setUniform(materials.orbit, 'uTime', ambient);
    setUniform(materials.glyphs, 'uTime', ambient);
    if (lettered) spellRing(glyphGeometry);
    setUniform(materials.outer, 'uTime', ambient);
    setUniform(materials.surface, 'uTime', ambient);
    // The portal ripples with the barrel roll
    setUniform(materials.surface, 'uRipple', Math.max(trickProgress(r, rollTime * 1.6), 0));

    const float = floatRef.current;
    if (float) {
      // Watches the pointer, leans in when hovered, barrel-rolls when clicked
      const roll = trickProgress(r, rollTime);
      const hop = roll >= 0 ? Math.sin(roll * Math.PI) * 0.55 : 0;
      float.position.y = Math.sin(ambient * 0.9) * 0.18 + r.amount * 0.12 + hop;
      float.rotation.y = -0.5 + Math.sin(ambient * 0.25) * 0.12 + r.yaw * 0.6;
      float.rotation.x = -r.pitch * 0.3 - r.amount * 0.12;
      float.rotation.z =
        Math.sin(ambient * 0.6) * 0.06 +
        Math.sin(ambient * 7) * 0.035 * r.amount +
        (roll >= 0 ? easeInOut(roll) * Math.PI * 2 : 0);
      float.scale.setScalar(1 + r.amount * 0.05);
    }
    if (portalRef.current) portalRef.current.rotation.z = ambient * 0.05;
    // At the still level the lettered ring holds still, its line starting at the top
    if (orbitRef.current) {
      orbitRef.current.rotation.z = lettered && still ? 0 : 0.4 - ambient * 0.08;
    }
    if (outerRef.current) outerRef.current.rotation.z = ambient * 0.03;
    if (hubRef.current) hubRef.current.rotation.y = 0.7 + ambient * 0.085;
  });

  return (
    <StationScope station="home">
      <group ref={groupRef} position={stationPositions.home}>
        <Billboard position={[0, 0, -3]}>
          <mesh material={materials.halo} scale={10}>
            <planeGeometry />
          </mesh>
        </Billboard>
        <Billboard position={[1.4, -1.2, -3.4]}>
          <mesh material={materials.haloCyan} scale={7}>
            <planeGeometry />
          </mesh>
        </Billboard>

        <group rotation={[0.18, -0.22, 0]} position={[0, 0, -1.6]}>
          <mesh material={materials.surface}>
            <circleGeometry args={[2.74, 128]} />
          </mesh>
          <mesh ref={portalRef} material={materials.portal}>
            <torusGeometry args={[2.75, 0.03, 16, 220]} />
          </mesh>
          <group ref={orbitRef} rotation={[0, 0, 0.4]}>
            <mesh material={materials.orbit} visible={!lettered}>
              <torusGeometry args={[ringRadius, 0.014, 8, 260]} />
            </mesh>
            <mesh
              geometry={glyphGeometry}
              material={materials.glyphs}
              visible={lettered}
              frustumCulled={false}
            />
          </group>
          <mesh ref={outerRef} material={materials.outer}>
            <torusGeometry args={[3.9, 0.01, 8, 300]} />
          </mesh>
        </group>

        {/* The gateway hub the astronaut has stepped out of */}
        <group position={[4.2, 3.1, -16]} rotation={[0.16, 0, -0.1]}>
          <group ref={hubRef}>
            <StationHull station="home" height={7.2} theme={theme} />
            {/* Wings tilted towards the sun (and the visitor) */}
            <SolarArray
              position={[3.3, 0.5, 0]}
              rotation={[1.15, 0, 0]}
              length={8}
              width={1.8}
              panels={5}
            />
            <group position={[-3.3, 0.5, 0]} rotation={[0, Math.PI, 0]}>
              <SolarArray rotation={[-1.15, 0, 0]} length={8} width={1.8} panels={5} />
            </group>
            <Antenna position={[0.5, 3.5, 0.4]} height={2.8} dish={0.75} />
            <NavLights lights={hubLights} />
          </group>
        </group>

        <Shards count={18} radius={3.4} seed={3} theme={theme} />

        <group ref={floatRef}>
          <Model url={stationModels.home!} height={3.5} theme={theme} />
          {/* Never drawn: the astronaut's target for the pointer (a capsule, not its triangles) */}
          <mesh visible={false} {...handlers}>
            <capsuleGeometry args={[1.05, 1.5, 4, 12]} />
          </mesh>
        </group>
      </group>
    </StationScope>
  );
}
