'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  MathUtils,
  NormalBlending,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';

import { ambientTime } from './clock';
import { navigableStations, stationNames } from './routes';
import { beaconHeight, pageCopyShown, stationPositions } from './stations';
import { palettes } from './utils';
import { queueUpload } from './warmup';
import { worldMode } from './worldMode';
import { worldStore } from './worldStore';

import type { Camera, WebGLRenderer } from 'three';
import type { StationKey } from './stations';
import type { WorldTheme } from './utils';

/** Every beacon, the derelict's last (it shows only on the 404 page) */
const beaconKeys: StationKey[] = [...navigableStations, 'lost'];

const position = new Vector3();
const projected = new Vector3();

function canvasTexture(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A soft round glow in `color`, white at the heart */
function paintGlow(texture: CanvasTexture, color: string) {
  const canvas = texture.image as HTMLCanvasElement;
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.12, color);
  gradient.addColorStop(0.4, `${color}55`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  texture.needsUpdate = true;
}

/** The label canvas's size, and the size of its first line's type in it */
const labelWidth = 512;
const labelHeight = 128;
const labelFont = 40;

/**
 * The station's number, page and craft, in the site's mono face, for the
 * theme in `texture.userData.theme` (repainted once the web font is ready:
 * the first paint may use the fallback)
 */
function paintLabel(texture: CanvasTexture, index: number, key: StationKey, gl: WebGLRenderer) {
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const family =
    getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono').trim() ||
    'ui-monospace, monospace';
  const paint = () => {
    const dark = texture.userData.theme === 'dark';
    ctx.clearRect(0, 0, labelWidth, labelHeight);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `600 ${labelFont}px ${family}`;
    ctx.fillStyle = dark ? '#e0e7ff' : '#1e1b4b';
    ctx.shadowColor = dark ? 'rgba(5, 6, 13, 0.9)' : 'rgba(238, 240, 248, 0.9)';
    ctx.shadowBlur = 12;
    const { page, craft } = stationNames[key];
    ctx.fillText(`${String(index).padStart(2, '0')} · ${page.toUpperCase()}`, 256, 46);
    ctx.font = `500 26px ${family}`;
    ctx.fillStyle = dark ? '#67e8f9' : '#0e7490';
    ctx.fillText(craft.toUpperCase(), 256, 94);
    texture.needsUpdate = true;
    // Uploaded on a coming frame (one a frame), not in the first frame that names it
    queueUpload(gl, texture);
  };
  paint();
  if (!texture.userData.fontReady) {
    document.fonts?.load(`600 ${labelFont}px ${family}`).then(
      () => {
        texture.userData.fontReady = true;
        paint();
      },
      () => undefined
    );
  }
}

interface BeaconAssets {
  glow: CanvasTexture;
  destination: CanvasTexture;
  beacons: { key: StationKey; glow: SpriteMaterial; label: SpriteMaterial; text: CanvasTexture }[];
}

/**
 * A theme change repaints the textures and swaps the glows' blending in
 * place: rebuilding the materials disposed the old ones before the new had
 * drawn, so both sprite programs were deleted and relinked mid-switch
 */
function applyBeaconTheme(assets: BeaconAssets, theme: WorldTheme, gl: WebGLRenderer) {
  const palette = palettes[theme];
  paintGlow(assets.glow, palette.cyan);
  paintGlow(assets.destination, palette.pink);
  queueUpload(gl, assets.glow);
  queueUpload(gl, assets.destination);
  const blending = theme === 'dark' ? AdditiveBlending : NormalBlending;
  assets.beacons.forEach((beacon, i) => {
    beacon.glow.blending = blending;
    beacon.text.userData.theme = theme;
    paintLabel(beacon.text, i, beacon.key, gl);
  });
}

/** Labels fit the screen: a portrait one's narrow width shrinks them, down to type this many pixels high */
const smallestType = 12;

/** On-screen boxes (CSS pixels) of the labels being laid out this frame: x0, y0, x1, y1 */
const placedBoxes: number[][] = [];

interface LabelBox {
  index: number;
  rank: number;
  box: [number, number, number, number];
}

/**
 * Where a label (anchored at `at`, scaled `width` × `height`) lands on
 * screen, in CSS pixels, or null when it is behind the camera. Sprites of
 * a fixed screen size: their size is in the projection's units
 */
function labelBox(
  at: Vector3,
  camera: Camera,
  width: number,
  height: number,
  screen: { width: number; height: number }
): [number, number, number, number] | null {
  projected.copy(at).applyMatrix4(camera.matrixWorldInverse);
  if (projected.z >= 0) return null;
  projected.copy(at).project(camera);
  const p = camera.projectionMatrix.elements;
  const halfWidth = 0.5 * width * p[0];
  // The label's centre is set 0.35 of its height below its bottom edge (sprite `center`)
  const bottom = projected.y + 0.35 * height * p[5];
  const top = projected.y + 1.35 * height * p[5];
  const toX = (x: number) => ((x + 1) / 2) * screen.width;
  const toY = (y: number) => ((1 - y) / 2) * screen.height;
  return [toX(projected.x - halfWidth), toY(top), toX(projected.x + halfWidth), toY(bottom)];
}

/** How much of a box lies on screen, 0..1 */
function onScreen(box: [number, number, number, number], width: number, height: number) {
  const [x0, y0, x1, y1] = box;
  const area = (x1 - x0) * (y1 - y0);
  if (area <= 0) return 0;
  const w = Math.max(0, Math.min(x1, width) - Math.max(x0, 0));
  const h = Math.max(0, Math.min(y1, height) - Math.max(y0, 0));
  return (w * h) / area;
}

const overlaps = (a: number[], b: number[]) =>
  a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/**
 * A light above every station, visible from anywhere in the world, so the
 * stations read as one place: from any page the others glow in the
 * distance. A link being hovered or focused flares its station's light, a
 * preview of the course (not its name: the page's copy is still showing).
 * In free roam the lights burn bigger and brighter to steer by (the HUD's
 * markers name them), and the autopilot's destination pulses.
 *
 * Names appear on a flight once it is under way (0.7s in, or 15% of the
 * way), until its final approach, when the new page's copy arrives over
 * them; never while a page's copy is on screen (the warp in as the site
 * loads), nor in free roam. On a narrow or portrait screen, and on the
 * tour (whose card names the stop it is at), only the destination is
 * named. Labels are laid out each frame: nearest first, with the
 * destination ahead of the rest, one that would overlap a label already
 * placed, or lie more than 10% off screen, is left out.
 */
export function Beacons({ theme, current }: { theme: WorldTheme; current: StationKey }) {
  const gl = useThree((s) => s.gl);
  const groupRef = useRef<Group>(null);
  /** 0..1: how far the beacons have brightened for free roam */
  const beacons = useRef(0);
  /** Each label's opacity to head for this frame, and its beacon's presence */
  const labels = useRef(beaconKeys.map(() => ({ target: 0, presence: 0 })));

  // Built once: a theme change repaints and reblends them (applyBeaconTheme)
  const assets = useMemo<BeaconAssets>(() => {
    const glow = canvasTexture(128, 128);
    const destination = canvasTexture(128, 128);
    return {
      glow,
      destination,
      beacons: beaconKeys.map((key) => {
        const text = canvasTexture(labelWidth, labelHeight);
        return {
          key,
          text,
          glow: new SpriteMaterial({
            map: glow,
            blending: AdditiveBlending,
            transparent: true,
            depthWrite: false,
            sizeAttenuation: false,
            fog: false,
          }),
          label: new SpriteMaterial({
            map: text,
            transparent: true,
            depthWrite: false,
            sizeAttenuation: false,
            fog: false,
            opacity: 0,
          }),
        };
      }),
    };
  }, []);

  useEffect(() => applyBeaconTheme(assets, theme, gl), [assets, theme, gl]);

  useEffect(
    () => () => {
      assets.glow.dispose();
      assets.destination.dispose();
      for (const beacon of assets.beacons) {
        beacon.text.dispose();
        beacon.glow.dispose();
        beacon.label.dispose();
      }
    },
    [assets]
  );

  useFrame((state, delta) => {
    const { camera, size } = state;
    const group = groupRef.current;
    if (!group) return;
    const { mode } = worldMode.get();
    const flight = worldStore.flight;
    const exploring = mode === 'explore';
    const touring = mode === 'tour';
    // Under way (not the first moments of a flight, where names only flicker past)
    const underway = flight.progress * flight.duration >= 0.7 || flight.progress > 0.15;
    const naming =
      flight.active &&
      !flight.approached &&
      underway &&
      (touring || (mode === 'page' && !pageCopyShown()));
    const only = touring || size.width < 760 || size.width < size.height ? flight.to : '';
    const previewing = mode === 'page' && !flight.active ? worldStore.preview : '';
    // The pulses are idle motion: they hold at the still level
    const t = ambientTime(state);
    const dt = Math.min(delta, 0.05);
    const bright = (beacons.current = MathUtils.damp(beacons.current, exploring ? 1 : 0, 3, dt));

    // Labels shrink on a portrait screen (min(1, aspect / 1.2)), never below legible type
    camera.updateMatrixWorld();
    const typeHeight = (labelFont / labelWidth) * 0.24 * 0.5 * camera.projectionMatrix.elements[5];
    const legible = smallestType / Math.max(typeHeight * size.height, 1e-3);
    const scale = Math.min(1, Math.max(size.width / size.height / 1.2, legible));
    const labelWidthScale = 0.24 * scale;
    const labelHeightScale = 0.06 * scale;
    const wanted: LabelBox[] = [];

    assets.beacons.forEach((beacon, i) => {
      const node = group.children[i] as Group | undefined;
      if (!node) return;
      const shown = beacon.key !== 'lost' || current === 'lost';
      node.visible = shown;
      if (!shown) return;
      const [glow, label] = node.children as Sprite[];
      position.copy(node.position);
      const distance = camera.position.distanceTo(position);
      // Fade out as you arrive: the station itself takes over
      const presence = MathUtils.smoothstep(distance, 22, 60);
      const previewed = previewing === beacon.key;
      const target =
        (flight.active && flight.to === beacon.key) ||
        (exploring && worldStore.autopilot === beacon.key) ||
        previewed;
      const pulse = target
        ? 0.75 + 0.25 * Math.sin(t * 5)
        : 1 + 0.12 * bright * Math.sin(t * 2 + i);

      beacon.glow.map = target ? assets.destination : assets.glow;
      beacon.glow.opacity = presence * MathUtils.lerp(target ? 1 : 0.7, 1, bright) * pulse;
      glow.scale.setScalar(
        MathUtils.lerp(target ? 0.075 : 0.05, target ? 0.11 : 0.085, bright) * pulse
      );
      glow.visible = beacon.glow.opacity > 0.01;

      label.scale.set(labelWidthScale, labelHeightScale, 1);
      const named = naming && presence > 0.01 && (!only || only === beacon.key);
      const box = named
        ? labelBox(position, camera, labelWidthScale, labelHeightScale, size)
        : null;
      // The destination first, then the nearest
      if (box)
        wanted.push({ index: i, rank: (flight.to === beacon.key ? -1e6 : 0) + distance, box });
      labels.current[i].target = 0;
      labels.current[i].presence = presence;
    });

    // Lay the labels out: each that fits on screen and clear of those placed before it
    wanted.sort((a, b) => a.rank - b.rank);
    placedBoxes.length = 0;
    for (const { index, box } of wanted) {
      if (onScreen(box, size.width, size.height) < 0.9) continue;
      if (placedBoxes.some((other) => overlaps(box, other))) continue;
      placedBoxes.push(box);
      labels.current[index].target = labels.current[index].presence;
    }

    assets.beacons.forEach((beacon, i) => {
      const node = group.children[i] as Group | undefined;
      if (!node?.visible) return;
      const label = node.children[1] as Sprite;
      const material = beacon.label;
      material.opacity = MathUtils.damp(material.opacity, labels.current[i].target, 5, dt);
      label.visible = material.opacity > 0.01;
    });
  });

  return (
    <group ref={groupRef}>
      {assets.beacons.map((beacon) => {
        const [x, y, z] = stationPositions[beacon.key];
        return (
          <group key={beacon.key} position={[x, y + beaconHeight(beacon.key), z]}>
            <sprite material={beacon.glow} renderOrder={5} />
            <sprite
              material={beacon.label}
              center={[0.5, -0.35]}
              scale={[0.24, 0.06, 1]}
              renderOrder={6}
            />
          </group>
        );
      })}
    </group>
  );
}
