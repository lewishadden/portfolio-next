'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { DirectionalLight, Object3D, Vector3 } from 'three';

import { sunDirection } from './sky';
import { stationPositions } from './stations';
import { palettes } from './utils';

import type { StationKey } from './stations';
import type { WorldTheme } from './utils';

const focus = new Vector3();

/**
 * One sun lights the whole world, from the same direction the sky's sun
 * glow and the lens flare sit in. Its shadow camera follows the active
 * station (a tight box, so the shadow map's resolution goes where it is
 * seen); a cool sky fill and a faint violet bounce keep the shadow side
 * readable without flattening it.
 */
export function Lighting({
  theme,
  station,
  shadows,
}: {
  theme: WorldTheme;
  station: StationKey;
  shadows: boolean;
}) {
  const sunRef = useRef<DirectionalLight>(null);
  const targetRef = useRef<Object3D>(null);
  const palette = palettes[theme];
  const dark = theme === 'dark';

  useEffect(() => {
    const sun = sunRef.current;
    const target = targetRef.current;
    if (sun && target) sun.target = target;
  }, []);

  useFrame(({ camera }, delta) => {
    const sun = sunRef.current;
    const target = targetRef.current;
    if (!sun || !target) return;
    // Follow the station while settled; follow the camera while it travels
    focus.fromArray(stationPositions[station]);
    if (camera.position.distanceTo(focus) > 40) focus.copy(camera.position);
    easing.damp3(target.position, focus, 0.35, Math.min(delta, 0.05));
    sun.position.copy(target.position).addScaledVector(sunDirection, 60);
  });

  return (
    <>
      <ambientLight intensity={palette.ambient * 0.35} />
      <hemisphereLight
        args={[dark ? '#8fa2ff' : '#dbe4ff', dark ? '#2a1450' : '#f3e8ff', dark ? 0.42 : 0.9]}
      />
      {/* Violet bounce from the side away from the sun */}
      <directionalLight
        position={sunDirection.clone().multiplyScalar(-40).toArray()}
        color={dark ? '#6d4dff' : '#b9a6ff'}
        intensity={dark ? 0.35 : 0.5}
      />
      <object3D ref={targetRef} />
      <directionalLight
        ref={sunRef}
        color={dark ? '#fff1e0' : '#ffffff'}
        intensity={palette.key * 1.55}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />
    </>
  );
}
