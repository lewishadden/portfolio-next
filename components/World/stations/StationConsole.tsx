'use client';

import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

import { inspectEntity } from '../inspection';
import { spawnPing } from '../Pings';
import { setWorldHover, worldTip } from '../worldStore';

import type { StationKey } from '../routes';
import type { WorldTheme } from '../utils';
import type { WorldTip } from '../worldStore';

/** A fixed display on a bracket: scene geometry gives each reading surface a home. */
export function StationConsole({
  station,
  title,
  subtitle,
  position,
  theme,
}: {
  station: StationKey;
  title: string;
  subtitle: string;
  position: [number, number, number];
  theme: WorldTheme;
}) {
  const selection = { kind: 'station' as const, id: station, station };
  const tip = useMemo<WorldTip>(() => ({ label: title, sub: subtitle }), [title, subtitle]);
  const shownTip = useRef<WorldTip | null>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const light = theme === 'light';
      ctx.fillStyle = light ? '#e9edf4' : '#111726';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = light ? '#0e7490' : '#67e8f9';
      ctx.lineWidth = 3;
      ctx.strokeRect(16, 16, 736, 288);
      ctx.fillStyle = light ? '#0e7490' : '#67e8f9';
      ctx.font = '22px monospace';
      ctx.fillText(`${station.toUpperCase()} / OPEN CONSOLE`, 42, 66);
      ctx.fillStyle = light ? '#182236' : '#f1f5ff';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText(title, 42, 151, 680);
      ctx.font = '26px sans-serif';
      ctx.fillText(subtitle, 42, 220, 680);
      ctx.fillStyle = light ? '#6d28d9' : '#a78bfa';
      ctx.fillRect(42, 259, 110, 5);
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, [station, title, subtitle, theme]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group position={position} rotation={[-0.08, 0, 0]}>
      <mesh position={[0, -0.75, -0.28]}>
        <boxGeometry args={[0.14, 1.25, 0.18]} />
        <meshStandardMaterial
          color={theme === 'light' ? '#8795ad' : '#343d57'}
          metalness={0.65}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, -1.36, -0.28]}>
        <boxGeometry args={[1.6, 0.12, 0.7]} />
        <meshStandardMaterial
          color={theme === 'light' ? '#8795ad' : '#343d57'}
          metalness={0.65}
          roughness={0.35}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[3.3, 1.5, 0.18]} />
        <meshStandardMaterial
          color={theme === 'light' ? '#697890' : '#29324b'}
          metalness={0.65}
          roughness={0.3}
        />
      </mesh>
      <mesh
        position={[0, 0, 0.1]}
        userData={{ inspection: selection }}
        onPointerOver={(event) => {
          event.stopPropagation();
          shownTip.current = { ...tip, anchor: event.point.toArray() };
          setWorldHover(true);
          worldTip.set(shownTip.current);
        }}
        onPointerOut={() => {
          setWorldHover(false);
          if (worldTip.get() === shownTip.current) worldTip.set(null);
        }}
        onClick={(event) => {
          event.stopPropagation();
          spawnPing(event.point);
          inspectEntity({ ...selection, anchor: event.point.toArray() });
        }}
      >
        <planeGeometry args={[3.1, 1.3]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
