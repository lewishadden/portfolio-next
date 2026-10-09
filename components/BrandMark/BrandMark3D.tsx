'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  PMREMGenerator,
  Shape,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { lettersCentre, outlineH, outlineL, ring } from './markGeometry';
import { createMarkMotion } from './markMotion';

import type { BufferGeometry, Scene, Texture, WebGLRenderer } from 'three';
import type { MarkPose } from './markMotion';

/* ------------------------------------------------------------------
   The LH orbital monogram as a real 3D model, for the header (see
   HeaderMark, which swaps it in for the SVG once the 3D world is up).
   Same geometry as markGeometry.ts, in its units with y up and the
   letters' centre at the origin: the letters are extruded and bevelled,
   the ring is a torus inclined so it projects to the SVG's ellipse, so
   the depth buffer does the passing in front of the letters low down
   (through the L's foot and across the H) and behind them at the top. The moon and
   the station notch move as in markMotion.ts; the whole mark sways
   slowly and leans towards the pointer while it hovers.
   ------------------------------------------------------------------ */

type Theme = 'dark' | 'light';

/** Pointer over the logo, -1..1 from its centre, written by HeaderMark */
export interface MarkPointer {
  x: number;
  y: number;
  over: boolean;
}

/** Lit surfaces brighten, so the dark theme starts from deeper tones than the SVG's */
const palette: Record<Theme, { violet: string; cyan: string; moon: string; glow: string }> = {
  dark: { violet: '#8b5cf6', cyan: '#06b6d4', moon: '#ffffff', glow: '#67e8f9' },
  light: { violet: '#6d28d9', cyan: '#0e7490', moon: '#0e7490', glow: '#0891b2' },
};

const degrees = Math.PI / 180;
const inclination = Math.acos(ring.ry / ring.rx);
/** The SVG tilts anticlockwise on screen with y down; the same turn with y up */
const tilt = -ring.tilt * degrees;
const ringCentreY = lettersCentre.y - ring.cy;
const ghosts = 6;
/** The canvas shows this many units top to bottom (HeaderMark sizes it to match the SVG) */
export const stageUnits = 80;
const fov = 22;
const cameraDistance = stageUnits / 2 / Math.tan((fov / 2) * degrees);
/** The notch: how much of the ring it covers (radians) */
const notchArc = 0.16;

/** A polygon with its corners rounded (radius r), as a three Shape */
function roundedShape(points: readonly (readonly [number, number])[], r: number) {
  const shape = new Shape();
  const toward = (p: readonly [number, number], q: readonly [number, number]) => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const length = Math.hypot(dx, dy);
    const k = Math.min(r, length / 2) / length;
    return [p[0] + dx * k, p[1] + dy * k] as const;
  };
  points.forEach((point, i) => {
    const before = points[(i + points.length - 1) % points.length];
    const after = points[(i + 1) % points.length];
    const a = toward(point, before);
    const b = toward(point, after);
    if (i === 0) shape.moveTo(a[0], a[1]);
    else shape.lineTo(a[0], a[1]);
    shape.quadraticCurveTo(point[0], point[1], b[0], b[1]);
  });
  shape.closePath();
  return shape;
}

/** Colours a geometry's vertices along a gradient, `along` giving 0..1 per vertex */
function paint(
  geometry: BufferGeometry,
  from: string,
  to: string,
  along: (x: number, y: number) => number
) {
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const a = new Color(from);
  const b = new Color(to);
  const c = new Color();
  for (let i = 0; i < position.count; i++) {
    c.lerpColors(a, b, Math.min(Math.max(along(position.getX(i), position.getY(i)), 0), 1));
    c.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

function letterGeometry(outline: readonly (readonly [number, number])[], theme: Theme) {
  const points = outline.map(([x, y]) => [x - lettersCentre.x, lettersCentre.y - y] as const);
  const geometry = new ExtrudeGeometry(roundedShape(points, 1.6), {
    depth: 7,
    bevelEnabled: true,
    bevelThickness: 1.2,
    bevelSize: 0.75,
    bevelOffset: -0.75,
    bevelSegments: 4,
    curveSegments: 6,
  });
  geometry.translate(0, 0, -3.5);
  // Violet top left to cyan bottom right, as the SVG's gradient
  return paint(
    geometry,
    palette[theme].violet,
    palette[theme].cyan,
    (x, y) => (x + 22 + 15 - y) / 74
  );
}

function glowTexture(color: string) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.2, color);
    gradient.addColorStop(0.55, `${color}40`);
    gradient.addColorStop(1, `${color}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Builds everything theme-dependent once per theme */
function buildAssets(theme: Theme) {
  const colors = palette[theme];
  const glowMap = glowTexture(colors.glow);
  const blending = theme === 'dark' ? AdditiveBlending : NormalBlending;
  const letters = new MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.15,
    roughness: 0.38,
    envMapIntensity: 0.35,
    emissive: new Color(colors.violet),
    emissiveIntensity: theme === 'dark' ? 0.08 : 0.04,
  });
  const glow = (opacity: number) =>
    new SpriteMaterial({
      map: glowMap,
      blending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      opacity,
    });
  return {
    glowMap,
    letterL: letterGeometry(outlineL, theme),
    letterH: letterGeometry(outlineH, theme),
    // Cyan at the ring's left end to violet at its right, as the SVG
    ring: paint(
      new TorusGeometry(ring.rx, 0.95, 16, 220),
      colors.cyan,
      colors.violet,
      (x) => (x + ring.rx) / (ring.rx * 2)
    ),
    notch: new TorusGeometry(ring.rx, 1.5, 12, 16, notchArc),
    // Low metal and soft reflections, so the gradient stays saturated
    letters,
    ringMaterial: new MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.3,
      roughness: 0.32,
      envMapIntensity: 0.5,
      emissive: new Color(colors.cyan),
      emissiveIntensity: theme === 'dark' ? 0.22 : 0.06,
    }),
    bright: new MeshBasicMaterial({ color: colors.moon, toneMapped: false }),
    moonGlow: glow(0.9),
    notchGlow: glow(0.75),
    ghostGlows: Array.from({ length: ghosts }, () => glow(0)),
  };
}

type Assets = ReturnType<typeof buildAssets>;

function disposeAssets(assets: Assets) {
  assets.glowMap.dispose();
  for (const geometry of [assets.letterL, assets.letterH, assets.ring, assets.notch]) {
    geometry.dispose();
  }
  for (const material of [
    assets.letters,
    assets.ringMaterial,
    assets.bright,
    assets.moonGlow,
    assets.notchGlow,
    ...assets.ghostGlows,
  ]) {
    material.dispose();
  }
}

/** Studio reflections for the bevels (RoomEnvironment: built locally, nothing fetched) */
function lightScene(gl: WebGLRenderer, scene: Scene) {
  const pmrem = new PMREMGenerator(gl);
  const texture: Texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = texture;
  return () => {
    if (scene.environment === texture) scene.environment = null;
    texture.dispose();
  };
}

/** Where on the ring (its own plane, 3D) an angle in markGeometry's convention is */
function onRing(angle: number, out: { x: number; y: number }) {
  // The SVG's angles run clockwise with y down; the torus's anticlockwise with y up
  out.x = ring.rx * Math.cos(angle);
  out.y = -ring.rx * Math.sin(angle);
  return out;
}

const point = { x: 0, y: 0 };

/** Places the moon, its ghosts and the notch for a pose */
function pose3D(rig: Group, pose: MarkPose, assets: Assets) {
  const [moon, notch, notchGlow, ...trail] = rig.children;
  onRing(pose.moon, point);
  moon.position.set(point.x, point.y, 0);
  notch.rotation.z = -pose.notch - notchArc / 2;
  onRing(pose.notch, point);
  notchGlow.position.set(point.x, point.y, 0);
  trail.forEach((ghost, i) => {
    // Behind the moon along its way round, further apart the faster it goes
    onRing(pose.moon + (i + 1) * (0.07 + pose.rush * 0.09), point);
    ghost.position.set(point.x, point.y, 0);
    assets.ghostGlows[i].opacity = pose.rush * 0.7 * (1 - i / ghosts);
  });
}

function Mark({
  theme,
  pointer,
  onReady,
  onGone,
}: {
  theme: Theme;
  pointer: { current: MarkPointer };
  onReady: () => void;
  onGone: () => void;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const assets = useMemo(() => buildAssets(theme), [theme]);
  const swayRef = useRef<Group>(null);
  const rigRef = useRef<Group>(null);
  const motion = useMemo(() => createMarkMotion(), []);
  const ready = useRef(false);

  useEffect(() => () => disposeAssets(assets), [assets]);
  useEffect(() => lightScene(gl, scene), [gl, scene]);
  useEffect(() => onGone, [onGone]);

  useFrame(({ clock }, delta) => {
    const sway = swayRef.current;
    const rig = rigRef.current;
    if (!sway || !rig) return;
    const dt = Math.min(delta, 0.1);
    const t = clock.elapsedTime;
    const { over, x, y } = pointer.current;
    pose3D(rig, motion.step(dt, over, false), assets);
    // A slow sway; hovering leans the mark towards the pointer
    const yaw = over ? x * 0.6 : Math.sin(t * 0.45) * 0.36;
    const pitch = over ? -y * 0.45 : Math.sin(t * 0.33) * 0.14;
    const ease = 1 - Math.exp(-(over ? 8 : 2.5) * dt);
    sway.rotation.y += (yaw - sway.rotation.y) * ease;
    sway.rotation.x += (pitch - sway.rotation.x) * ease;
    if (!ready.current) {
      ready.current = true;
      onReady();
    }
  });

  return (
    <group ref={swayRef}>
      <mesh geometry={assets.letterL} material={assets.letters} />
      <mesh geometry={assets.letterH} material={assets.letters} />
      <group position={[0, ringCentreY, 0]} rotation={[0, 0, tilt]}>
        <group rotation={[-inclination, 0, 0]}>
          <mesh geometry={assets.ring} material={assets.ringMaterial} />
          <group ref={rigRef}>
            <group>
              <mesh material={assets.bright}>
                <sphereGeometry args={[2.3, 24, 16]} />
              </mesh>
              <sprite material={assets.moonGlow} scale={13} />
            </group>
            <mesh geometry={assets.notch} material={assets.bright} />
            <sprite material={assets.notchGlow} scale={9} />
            {assets.ghostGlows.map((material, i) => (
              <sprite key={i} material={material} scale={7 - i * 0.7} />
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

/** Whether the page (and the header with it) is showing: html[data-world-mode] is `page` */
const subscribeMode = (listener: () => void) => {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-world-mode'],
  });
  return () => observer.disconnect();
};
const pageShowing = () => (document.documentElement.dataset.worldMode ?? 'page') === 'page';
const showingOnServer = () => true;

/**
 * The 3D mark's canvas: transparent, small, antialiased. `onReady` fires
 * after its first frame, when HeaderMark fades it in over the SVG. While
 * the header is hidden (the tour, free roam, the page coming back from
 * them) it draws nothing: on demand, with nothing asking.
 */
export default function BrandMark3D({
  theme,
  pointer,
  onReady,
  onGone,
}: {
  theme: Theme;
  pointer: { current: MarkPointer };
  onReady: () => void;
  /** Called when it unmounts, so the SVG shows again at once */
  onGone: () => void;
}) {
  const showing = useSyncExternalStore(subscribeMode, pageShowing, showingOnServer);
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={showing ? 'always' : 'demand'}
      flat
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      camera={{
        fov,
        position: [0, 0, cameraDistance],
        near: cameraDistance - 80,
        far: cameraDistance + 80,
      }}
    >
      {/* The dark theme's colours are light already: lit any brighter they wash out to white */}
      <ambientLight intensity={theme === 'dark' ? 0.38 : 1} />
      <directionalLight position={[-40, 60, 90]} intensity={theme === 'dark' ? 0.95 : 1.4} />
      <directionalLight
        position={[70, -30, -40]}
        intensity={theme === 'dark' ? 0.8 : 1.2}
        color="#22d3ee"
      />
      <Mark theme={theme} pointer={pointer} onReady={onReady} onGone={onGone} />
    </Canvas>
  );
}
