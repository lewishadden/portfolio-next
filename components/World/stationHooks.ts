'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Camera, Material, Object3D, ShaderMaterial, Vector3 } from 'three';

import { applyGlowTheme } from './materials';
import { isWideViewport, stationPositions } from './stations';
import { palettes } from './utils';

import type { StationKey } from './stations';
import type { WorldPalette, WorldTheme } from './utils';

export function useWide() {
  return useThree((s) => isWideViewport(s.size.width, s.size.height));
}

/**
 * Builds a station's materials for the current theme and disposes the previous set.
 * `factory` must be a stable module-level function.
 */
export function useThemedMaterials<T extends Record<string, Material>>(
  factory: (palette: WorldPalette) => T,
  theme: WorldTheme
): T {
  const materials = useMemo(() => {
    const built = factory(palettes[theme]);
    for (const material of Object.values(built)) {
      if (material instanceof ShaderMaterial) applyGlowTheme(material, theme);
    }
    return built;
  }, [factory, theme]);

  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material.dispose();
    },
    [materials]
  );

  return materials;
}

const stationVector = new Vector3();

/**
 * Hides a station (and lets its frame callback bail out early) once the
 * camera is far away — beyond the fog it would be invisible anyway.
 */
export function stationInRange(group: Object3D | null, camera: Camera, key: StationKey) {
  if (!group) return false;
  stationVector.fromArray(stationPositions[key]);
  const near = camera.position.distanceToSquared(stationVector) < 115 * 115;
  group.visible = near;
  return near;
}
