'use client';

import { useEffect, useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace } from 'three';

import { companyInitials } from 'components/Experience/timeline';

import type { WorldTheme } from '../utils';

/** The selected tether pod unfolds its own mission insignia beside the log. */
export function RoleMissionPatch({ company, number, theme }: { company: string; number: number; theme: WorldTheme }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 384;
    const context = canvas.getContext('2d');
    if (context) {
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = Math.PI / 3 * i - Math.PI / 2;
        const x = 192 + Math.cos(angle) * 174;
        const y = 192 + Math.sin(angle) * 174;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fillStyle = theme === 'light' ? '#e9edf4' : '#111726';
      context.fill();
      context.lineWidth = 6;
      context.strokeStyle = theme === 'light' ? '#0e7490' : '#67e8f9';
      context.stroke();
      context.textAlign = 'center';
      context.fillStyle = context.strokeStyle;
      context.font = '23px monospace';
      context.fillText(`MISSION ${String(number).padStart(2, '0')}`, 192, 112);
      context.fillStyle = theme === 'light' ? '#182236' : '#f1f5ff';
      context.font = 'bold 64px sans-serif';
      context.fillText(companyInitials(company), 192, 205, 260);
      context.font = '23px sans-serif';
      context.fillText(company, 192, 263, 260);
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, [company, number, theme]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <Billboard position={[1.3, 0.1, 0.2]}>
      <mesh position={[-0.6, 0, -0.06]}>
        <boxGeometry args={[1.3, 0.06, 0.08]} />
        <meshStandardMaterial color={theme === 'light' ? '#8795ad' : '#343d57'} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh>
        <planeGeometry args={[1.4, 1.4]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
    </Billboard>
  );
}
