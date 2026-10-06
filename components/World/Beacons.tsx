'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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

import { navigableStations, stationNames } from './routes';
import { beaconHeight, stationPositions } from './stations';
import { palettes } from './utils';
import { worldMode } from './worldMode';
import { worldStore } from './worldStore';

import type { StationKey } from './stations';
import type { WorldTheme } from './utils';

const position = new Vector3();

function glowTexture(color: string) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.12, color);
    gradient.addColorStop(0.4, `${color}55`);
    gradient.addColorStop(1, `${color}00`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The station's number, page and craft, in the site's mono face */
function labelTexture(index: number, key: StationKey, theme: WorldTheme) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const ctx = canvas.getContext('2d');
  if (!ctx) return texture;
  const family =
    getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono').trim() ||
    'ui-monospace, monospace';
  const dark = theme === 'dark';
  const paint = () => {
    ctx.clearRect(0, 0, 512, 128);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = `600 40px ${family}`;
    ctx.fillStyle = dark ? '#e0e7ff' : '#1e1b4b';
    ctx.shadowColor = dark ? 'rgba(5, 6, 13, 0.9)' : 'rgba(238, 240, 248, 0.9)';
    ctx.shadowBlur = 12;
    const { page, craft } = stationNames[key];
    ctx.fillText(`${String(index).padStart(2, '0')} · ${page.toUpperCase()}`, 256, 46);
    ctx.font = `500 26px ${family}`;
    ctx.fillStyle = dark ? '#67e8f9' : '#0e7490';
    ctx.fillText(craft.toUpperCase(), 256, 94);
    texture.needsUpdate = true;
  };
  paint();
  // Repaint once the web font is ready (the first paint may use the fallback)
  document.fonts?.load(`600 40px ${family}`).then(paint, () => undefined);
  return texture;
}

/**
 * A light above every station, visible from anywhere in the world, so the
 * stations read as one place: from any page the others glow in the distance.
 * Names appear while flying or touring, and the destination pulses. In free
 * roam the lights burn bigger and brighter to steer by (the HUD's markers
 * name them), and the autopilot's destination pulses.
 */
export function Beacons({ theme, current }: { theme: WorldTheme; current: StationKey }) {
  const groupRef = useRef<Group>(null);
  /** 0..1: how far the beacons have brightened for free roam */
  const beacons = useRef(0);
  const palette = palettes[theme];
  const keys = useMemo(
    () => (current === 'lost' ? [...navigableStations, 'lost' as const] : navigableStations),
    [current]
  );

  const assets = useMemo(() => {
    const glow = glowTexture(palette.cyan);
    const destination = glowTexture(palette.pink);
    const blending = theme === 'dark' ? AdditiveBlending : NormalBlending;
    return {
      glow,
      destination,
      beacons: keys.map((key, i) => ({
        key,
        glow: new SpriteMaterial({
          map: glow,
          blending,
          transparent: true,
          depthWrite: false,
          sizeAttenuation: false,
          fog: false,
          toneMapped: false,
        }),
        label: new SpriteMaterial({
          map: labelTexture(i, key, theme),
          transparent: true,
          depthWrite: false,
          sizeAttenuation: false,
          fog: false,
          toneMapped: false,
          opacity: 0,
        }),
      })),
    };
  }, [keys, theme, palette.cyan, palette.pink]);

  useEffect(
    () => () => {
      assets.glow.dispose();
      assets.destination.dispose();
      for (const beacon of assets.beacons) {
        beacon.label.map?.dispose();
        beacon.glow.dispose();
        beacon.label.dispose();
      }
    },
    [assets]
  );

  useFrame(({ camera, clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const { mode } = worldMode.get();
    const flight = worldStore.flight;
    const exploring = mode === 'explore';
    const showNames = mode === 'tour' || flight.active;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const bright = (beacons.current = MathUtils.damp(beacons.current, exploring ? 1 : 0, 3, dt));

    assets.beacons.forEach((beacon, i) => {
      const node = group.children[i] as Group | undefined;
      if (!node) return;
      const [glow, label] = node.children as Sprite[];
      position.copy(node.position);
      const distance = camera.position.distanceTo(position);
      // Fade out as you arrive: the station itself takes over
      const presence = MathUtils.smoothstep(distance, 22, 60);
      const target =
        (flight.active && flight.to === beacon.key) ||
        (exploring && worldStore.autopilot === beacon.key);
      const pulse = target
        ? 0.75 + 0.25 * Math.sin(t * 5)
        : 1 + 0.12 * bright * Math.sin(t * 2 + i);

      beacon.glow.map = target ? assets.destination : assets.glow;
      beacon.glow.opacity = presence * MathUtils.lerp(target ? 1 : 0.7, 1, bright) * pulse;
      glow.scale.setScalar(
        MathUtils.lerp(target ? 0.075 : 0.05, target ? 0.11 : 0.085, bright) * pulse
      );
      glow.visible = beacon.glow.opacity > 0.01;

      const labelTarget = showNames ? presence : 0;
      beacon.label.opacity = MathUtils.damp(beacon.label.opacity, labelTarget, 5, dt);
      label.visible = beacon.label.opacity > 0.01;
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
