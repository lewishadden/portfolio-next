'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  MathUtils,
  NormalBlending,
  Quaternion,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';

import { motionLevel } from '@/utils/motion';

import { pastStamp } from './clock';
import { asGlow, createFresnelMaterial } from './materials';
import { Antenna, NavLights, partMaterials, SolarArray, Truss } from './parts';
import { spawnPing } from './Pings';
import {
  cometAt,
  contactMarks,
  currentScan,
  detectorRange,
  isFound,
  isScanned,
  markFound,
  markScanned,
  reportNearest,
  scanClock,
  scanSweep,
  setSignalTime,
  signals,
} from './signalStore';
import { sunDirection } from './sky';
import { useThemedMaterials } from './stationHooks';
import { palettes } from './utils';
import { queueUpload } from './warmup';
import { worldMode } from './worldMode';
import { emitCue } from './worldStore';

import type { Camera, WebGLRenderer } from 'three';
import type { Signal } from './signalStore';
import type { WorldPalette, WorldTheme } from './utils';

/* ------------------------------------------------------------------
   The signals hidden in free roam (see signalStore.ts): a probe, a supply
   capsule, an open-source relay and a comet out among the asteroids,
   plus the 404 derelict (LostStation, mounted for free roam). Each
   unfound one carries a faint amber glow, only in free roam, so the
   world's other views stay as they were. Flying within reach finds it:
   a ping rings out from it, its glow bursts out to three times its size
   and fades, and a faint cyan ring stays round it from then on (free
   roam only), logged. Its nameplate flickers on for 4s, and shows again
   whenever the ship comes within 40 units of it.
   ------------------------------------------------------------------ */

const amber: Record<WorldTheme, string> = { dark: '#fbbf24', light: '#b45309' };

const tailUp = new Vector3(0, 1, 0);
const tailAway = new Vector3().copy(sunDirection).negate();

/** The burst as a signal is found: seconds, and how big the glow grows by its end */
const burstTime = 1.2;
const burstGrowth = 3;
/** The logged ring fades in after the burst, to this opacity */
const loggedOpacity = 0.3;
/** A find's nameplate: seconds it stays up, and how close (units) brings it back */
const plateTime = 4;
const plateRange = 40;
/** Glow sprites' size on screen (sizeAttenuation off: a share of the view's height) */
const glowSize = 0.03;
const loggedSize = 0.05;
const plateWidth = 0.22;
/** Each signal's group: its craft, then its glow, logged ring and nameplate */
const child = { glow: 1, logged: 2, plate: 3 };

const plateCanvas = { width: 512, height: 128 };

function canvasTexture(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A soft round glow in `color`, white at its heart */
function paintGlow(texture: CanvasTexture, color: string) {
  const canvas = texture.image as HTMLCanvasElement;
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.15, color);
  gradient.addColorStop(0.45, `${color}44`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  texture.needsUpdate = true;
}

/** The logged mark: a thin ring with a soft glow either side */
function paintRing(texture: CanvasTexture, color: string) {
  const canvas = texture.image as HTMLCanvasElement;
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.06;
  ctx.lineWidth = size * 0.035;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  texture.needsUpdate = true;
}

/** A signal's name over "Signal logged", in the site's mono face, for the theme */
function paintPlate(texture: CanvasTexture, name: string, theme: WorldTheme, family: string) {
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = plateCanvas;
  const dark = theme === 'dark';
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = dark ? 'rgba(5, 6, 13, 0.9)' : 'rgba(238, 240, 248, 0.9)';
  ctx.shadowBlur = 12;
  ctx.font = `600 40px ${family}`;
  ctx.fillStyle = dark ? '#fef3c7' : '#451a03';
  ctx.fillText(name.toUpperCase(), width / 2, 46);
  ctx.font = `500 26px ${family}`;
  ctx.fillStyle = dark ? '#67e8f9' : '#0e7490';
  ctx.fillText('SIGNAL LOGGED', width / 2, 94);
  texture.needsUpdate = true;
}

interface SignalAssets {
  glow: CanvasTexture;
  coma: CanvasTexture;
  ring: CanvasTexture;
  comaMaterial: SpriteMaterial;
  /** Per signal: its amber glow, logged ring and nameplate */
  glows: SpriteMaterial[];
  logged: SpriteMaterial[];
  plates: SpriteMaterial[];
  plateTextures: CanvasTexture[];
}

const glowSprite = (map: CanvasTexture, opacity: number) =>
  new SpriteMaterial({
    map,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: false,
    fog: false,
    toneMapped: false,
    opacity,
  });

/** Built once: a theme change repaints and reblends them in place (applySignalsTheme) */
function buildAssets(): SignalAssets {
  const glow = canvasTexture(96, 96);
  const coma = canvasTexture(96, 96);
  const ring = canvasTexture(128, 128);
  const plateTextures = signals.map(() => canvasTexture(plateCanvas.width, plateCanvas.height));
  return {
    glow,
    coma,
    ring,
    comaMaterial: new SpriteMaterial({
      map: coma,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      opacity: 0.9,
    }),
    glows: signals.map(() => glowSprite(glow, 0)),
    logged: signals.map(() => glowSprite(ring, 0)),
    plates: plateTextures.map((map) => glowSprite(map, 0)),
    plateTextures,
  };
}

/**
 * Paints the textures for the theme and uploads them a frame apart
 * (queueUpload), and sets the glows' blending. Rebuilding the materials
 * would dispose the old before the new had drawn
 */
function applySignalsTheme(assets: SignalAssets, theme: WorldTheme, gl: WebGLRenderer) {
  const palette = palettes[theme];
  paintGlow(assets.glow, amber[theme]);
  paintGlow(assets.coma, palette.cyan);
  paintRing(assets.ring, palette.cyan);
  for (const texture of [assets.glow, assets.coma, assets.ring]) queueUpload(gl, texture);
  const blending = theme === 'dark' ? AdditiveBlending : NormalBlending;
  for (const material of [assets.comaMaterial, ...assets.glows, ...assets.logged]) {
    material.blending = blending;
  }
  const family =
    getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono').trim() ||
    'ui-monospace, monospace';
  const paintPlates = () =>
    signals.forEach((signal, i) => {
      paintPlate(assets.plateTextures[i], signal.name, theme, family);
      queueUpload(gl, assets.plateTextures[i]);
    });
  paintPlates();
  // The web font may not have loaded for the first paint
  document.fonts?.load(`600 40px ${family}`).then(paintPlates, () => undefined);
}

function disposeAssets(assets: SignalAssets) {
  for (const texture of [assets.glow, assets.coma, assets.ring, ...assets.plateTextures]) {
    texture.dispose();
  }
  for (const material of [
    assets.comaMaterial,
    ...assets.glows,
    ...assets.logged,
    ...assets.plates,
  ]) {
    material.dispose();
  }
}

/** Per signal: when it was found (clock time, -Infinity before), and how its nameplate shows */
interface FindState {
  foundAt: number;
}

const sweepFrom = new Vector3();
const seen = new Vector3();
const onView = new Vector3();

/**
 * A sonar scan sweeping out from where the ship was (currentScan): each
 * unfound signal is picked out as the sweep's radius, detector range in
 * `scanSweep` seconds, passes it, with a ping where it is and the sonar's
 * cue from there
 */
function sweep(signal: Signal, at: Vector3) {
  const scan = currentScan();
  const age = scanClock() - scan.at;
  if (age < 0 || age > scanSweep + 0.1 || scan.hits.includes(signal.id)) return;
  const distance = at.distanceTo(sweepFrom.fromArray(scan.from));
  if (distance > detectorRange || distance > (age / scanSweep) * detectorRange) return;
  markScanned(signal.id);
  spawnPing(at, { scale: 2, flash: false, cue: false });
  emitCue('sonar', { at: [at.x, at.y, at.z], strength: 1 - distance / detectorRange });
}

/** Where a contact (scanned, not yet found) is on screen, for the HUD's marker */
function markContact(signal: Signal, at: Vector3, camera: Camera) {
  const mark = (contactMarks[signal.id] ??= { x: 0, y: 0, onScreen: false, distance: 0 });
  mark.distance = camera.position.distanceTo(at);
  onView.copy(at).applyMatrix4(camera.matrixWorldInverse);
  seen.copy(at).project(camera);
  if (onView.z < 0 && Math.abs(seen.x) <= 1 && Math.abs(seen.y) <= 1) {
    mark.x = seen.x;
    mark.y = seen.y;
    mark.onScreen = true;
  } else {
    // Off screen: the way to turn (straight behind reads as "turn round", downwards)
    const length = Math.hypot(onView.x, onView.y);
    mark.x = length > 1e-3 ? onView.x / length : 0;
    mark.y = length > 1e-3 ? onView.y / length : -1;
    mark.onScreen = false;
  }
}

const tailVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 normal = normalize(mat3(modelMatrix) * normal);
    vFacing = abs(dot(normal, normalize(cameraPosition - world.xyz)));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const tailFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLight;
  uniform float uStrength;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    // Bright and white at the head (the cone's tip), fading and cooling down
    // the tail, and soft at its edges, with faint streamers along it
    float along = vUv.y;
    float streamers = 0.75 + 0.25 * sin(vUv.x * 62.0) * sin(vUv.x * 23.0 + 1.3);
    float alpha = pow(along, 3.0) * pow(vFacing, 2.2) * streamers * uStrength;
    vec3 col = mix(uColor, vec3(1.0), pow(along, 6.0) * 0.7);
    gl_FragColor = vec4(col * mix(1.5, 0.9, uLight), alpha);
  }
`;

const tailMaterial = (color: string, strength: number) =>
  asGlow(
    new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uLight: { value: 0 },
        uStrength: { value: strength },
      },
      vertexShader: tailVertex,
      fragmentShader: tailFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  );

const buildMaterials = (p: WorldPalette) => ({
  window: createFresnelMaterial({ color: p.violet, power: 2.2, intensity: 1.8 }),
  /** A narrow, bright ion tail and a broad, faint dust tail */
  ionTail: tailMaterial(p.cyan, 0.55),
  dustTail: tailMaterial('#fde68a', 0.22),
});

function Probe() {
  const materials = partMaterials();
  return (
    <group>
      <mesh material={materials.gold} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.6, 10]} />
      </mesh>
      <Antenna height={1.1} dish={1.9} position={[0, 0.3, 0]} />
      <SolarArray length={1.8} width={0.5} panels={2} position={[0.55, 0, 0]} />
      <SolarArray
        length={1.8}
        width={0.5}
        panels={2}
        position={[-0.55, 0, 0]}
        rotation={[0, Math.PI, 0]}
      />
      <NavLights lights={[{ position: [0, -0.4, 0.5], kind: 'red' }]} size={0.07} />
    </group>
  );
}

function Capsule({ window }: { window: ShaderMaterial }) {
  const materials = partMaterials();
  return (
    <group rotation={[0, 0, 0.5]}>
      <mesh material={materials.panel} castShadow>
        <capsuleGeometry args={[0.55, 1.3, 6, 16]} />
      </mesh>
      <mesh material={window} scale={[1.02, 0.18, 1.02]}>
        <sphereGeometry args={[0.56, 24, 12]} />
      </mesh>
      <NavLights
        lights={[
          { position: [0, 1.25, 0], kind: 'white' },
          { position: [0, -1.25, 0], kind: 'green', phase: 0.5 },
        ]}
        size={0.07}
      />
    </group>
  );
}

function Relay() {
  return (
    <group>
      <Truss length={3.2} size={0.3} position={[0, -1.6, 0]} />
      <SolarArray length={2.6} width={0.8} panels={3} position={[0.2, 0.6, 0]} />
      <SolarArray
        length={2.6}
        width={0.8}
        panels={3}
        position={[-0.2, 0.6, 0]}
        rotation={[0, Math.PI, 0]}
      />
      <Antenna height={1.4} dish={2.4} position={[0, 1.4, 0]} />
      <NavLights
        lights={[
          { position: [0, 2.9, 0], kind: 'cyan' },
          { position: [0, -1.6, 0], kind: 'violet', phase: 0.4 },
        ]}
        size={0.06}
      />
    </group>
  );
}

const tailQuaternion = new Quaternion().setFromUnitVectors(tailUp, tailAway);

function Comet({
  coma,
  ionTail,
  dustTail,
}: {
  coma: SpriteMaterial;
  ionTail: ShaderMaterial;
  dustTail: ShaderMaterial;
}) {
  return (
    <group>
      {/* The nucleus, blazing, inside its coma: a soft glow */}
      <mesh>
        <icosahedronGeometry args={[0.6, 1]} />
        <meshBasicMaterial color="#e6faff" toneMapped={false} />
      </mesh>
      <sprite material={coma} scale={9} />
      {/* The tails stream away from the sun, their tips on the nucleus */}
      <group quaternion={tailQuaternion}>
        <mesh material={ionTail} position={[0, 17, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[1.6, 34, 32, 1, true]} />
        </mesh>
        <mesh material={dustTail} position={[0.8, 12, 0]} rotation={[Math.PI, 0, -0.12]}>
          <coneGeometry args={[4.2, 24, 32, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}

/** How a find's nameplate flickers on (full motion): on, off, on over its first 0.3s */
function flicker(s: number) {
  if (s < 0.08) return 1;
  if (s < 0.16) return 0.15;
  return 1;
}

/** Draws the signals and finds them as the explorer flies close */
export function Signals({ theme }: { theme: WorldTheme }) {
  const gl = useThree((s) => s.gl);
  const groupRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme);
  const assets = useMemo(() => buildAssets(), []);
  const finds = useRef<FindState[]>(signals.map(() => ({ foundAt: -Infinity })));

  useEffect(() => applySignalsTheme(assets, theme, gl), [assets, theme, gl]);
  useEffect(() => () => disposeAssets(assets), [assets]);

  useFrame(({ camera, clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const exploring = worldMode.get().mode === 'explore';
    const flickers = motionLevel() === 'full';
    let nearest = Infinity;
    // The HUD and the sector map follow the comet by this clock
    setSignalTime(t);

    signals.forEach((signal, i) => {
      const node = group.children[i] as Group | undefined;
      if (!node) return;
      if (signal.id === 'comet') cometAt(t, node.position);
      const model = node.children[0];
      if (model && signal.id !== 'derelict') {
        model.rotation.set(t * 0.11 + i, t * 0.07 * (i % 2 ? 1 : -1), t * 0.05);
      }
      const glow = node.children[child.glow] as Sprite;
      const logged = node.children[child.logged] as Sprite;
      const plate = node.children[child.plate] as Sprite;
      const find = finds.current[i];
      find.foundAt = pastStamp(find.foundAt, t);
      const found = isFound(signal.id);
      const distance = camera.position.distanceTo(node.position);

      // Found just now: the glow bursts out and fades. Otherwise a faint
      // amber glow, free roam only, until found
      const since = t - find.foundAt;
      const glowMaterial = assets.glows[i];
      if (since < burstTime) {
        const k = since / burstTime;
        glowMaterial.opacity = (1 - k) * (1 - k);
        glow.scale.setScalar(glowSize * (1 + (burstGrowth - 1) * (1 - (1 - k) ** 3)));
      } else {
        const target = exploring && !found ? MathUtils.smoothstep(distance, 10, 40) : 0;
        glowMaterial.opacity = MathUtils.damp(glowMaterial.opacity, target, 3, dt);
        glow.scale.setScalar(glowSize * (0.85 + 0.15 * Math.sin(t * 2.6 + i)));
      }
      glow.visible = glowMaterial.opacity > 0.01;

      // Logged: a faint cyan ring round it, in free roam, once the burst is over
      const loggedMaterial = assets.logged[i];
      const ring = exploring && found ? MathUtils.smoothstep(since, burstTime, burstTime + 0.5) : 0;
      loggedMaterial.opacity = ring * loggedOpacity;
      logged.visible = loggedMaterial.opacity > 0.005;
      logged.scale.setScalar(loggedSize);

      // Its nameplate: on for a few seconds as it is found (flickering on at
      // full motion), and again whenever the ship comes near
      const plateMaterial = assets.plates[i];
      const fresh = since < plateTime ? (flickers ? flicker(since) : 1) : 0;
      const near = MathUtils.smoothstep(plateRange - distance, 0, 8);
      const shown = exploring && found ? Math.max(fresh, near) : 0;
      plateMaterial.opacity =
        since < plateTime ? shown : MathUtils.damp(plateMaterial.opacity, shown, 4, dt);
      plate.visible = plateMaterial.opacity > 0.01;
      plate.scale.set(plateWidth, plateWidth / 4, 1);

      if (!exploring || found) {
        delete contactMarks[signal.id];
        return;
      }
      sweep(signal, node.position);
      if (isScanned(signal.id)) markContact(signal, node.position, camera);
      if (distance < signal.reach) {
        if (markFound(signal.id)) {
          find.foundAt = t;
          const at = [node.position.x, node.position.y, node.position.z] as const;
          spawnPing(node.position, { scale: signal.id === 'derelict' ? 4 : 2.5, cue: false });
          emitCue(signals.every((s) => isFound(s.id)) ? 'complete' : 'found', { at });
        }
        return;
      }
      nearest = Math.min(nearest, distance);
    });
    reportNearest(exploring ? nearest : Infinity);
  });

  return (
    <group ref={groupRef}>
      {signals.map((signal: Signal, i) => (
        <group key={signal.id} position={signal.position}>
          {signal.id === 'probe' && <Probe />}
          {signal.id === 'capsule' && <Capsule window={materials.window} />}
          {signal.id === 'relay' && <Relay />}
          {signal.id === 'comet' && (
            <Comet
              coma={assets.comaMaterial}
              ionTail={materials.ionTail}
              dustTail={materials.dustTail}
            />
          )}
          {/* The derelict is LostStation itself; it only needs the glow */}
          {signal.id === 'derelict' && <group />}
          <sprite material={assets.glows[i]} renderOrder={5} />
          <sprite material={assets.logged[i]} renderOrder={5} visible={false} />
          {/* Above the craft: its bottom edge a little over the centre */}
          <sprite
            material={assets.plates[i]}
            renderOrder={6}
            center={[0.5, -0.9]}
            visible={false}
          />
        </group>
      ))}
    </group>
  );
}
