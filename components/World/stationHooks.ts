'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Camera, Material, Object3D, ShaderMaterial, Vector3 } from 'three';

import { applyGlowTheme, chargeWith, retireMaterials } from './materials';
import { stationPower } from './power';
import { isWideViewport, stationPositions } from './stations';
import { palettes } from './utils';
import { worldMode } from './worldMode';
import { worldStore } from './worldStore';

import type { StationKey } from './stations';
import type { WorldPalette, WorldTheme } from './utils';

/** Lite devices (phones, touch): lighter hulls, no shadows, fewer particles */
export const LiteContext = createContext(false);
export const useLite = () => useContext(LiteContext);

export function useWide() {
  return useThree((s) => isWideViewport(s.size.width, s.size.height));
}

/**
 * Builds a station's materials for the current theme. The previous set is
 * retired (retireMaterials): disposed only once a compile of the whole
 * scene has handed its programs to the new one, so a theme switch relinks
 * no programs, even for a station hidden at the time. `factory` must be a
 * stable module-level function. With `station`, its glows follow that
 * station's power (power.tsx); never key it on a station that changes at
 * runtime. Only the theme may change: a set replaced for any other reason
 * waits in the retire queue, undisposed, until the next theme switch (only
 * ThemeRetire disposes it).
 */
export function useThemedMaterials<T extends Record<string, Material>>(
  factory: (palette: WorldPalette) => T,
  theme: WorldTheme,
  station?: StationKey
): T {
  const materials = useMemo(() => {
    const built = factory(palettes[theme]);
    for (const material of Object.values(built)) {
      if (!(material instanceof ShaderMaterial)) continue;
      applyGlowTheme(material, theme);
      if (station) chargeWith(material, stationPower[station].charge);
    }
    return built;
  }, [factory, theme, station]);

  useEffect(() => () => retireMaterials(Object.values(materials)), [materials]);

  return materials;
}

const stationVector = new Vector3();

/** How far away stations still draw: about where the fog swallows them */
let viewRange = 115;

/** Free roam and flights push the fog (and so this) out, so distant stations stay in sight */
export function setViewRange(range: number) {
  viewRange = range;
}

/**
 * A flight between pages (or tour stops) draws the fog back, so the
 * destination's hull and running lights show on the way in instead of
 * looming out of the fog on the final approach: the fog's near and far
 * distances during one (lite devices reach less far). The destination
 * itself draws out to `flightRange`, beyond the fog, so it never pops in.
 */
const flightFog = { near: 60, far: 280, liteFar: 180 };
const flightRange = 320;

/** A flight between pages or tour stops is under way (free roam's fog is its own) */
const pageFlight = () => worldStore.flight.active && worldMode.get().mode !== 'explore';

const fogGoal = { near: 0, far: 0 };

/**
 * Where the fog heads outside free roam: its own distances (`base`), or
 * drawn back while a flight between pages is under way, then back again
 * once it lands. ExploreControls eases the fog there (it owns free roam's
 * reach too). Read from the flight itself, not from anything set earlier in
 * the frame, so it doesn't matter which frame callback runs first.
 */
export function fogTarget(base: { near: number; far: number }, lite: boolean) {
  const flying = pageFlight();
  fogGoal.near = flying ? Math.max(base.near, flightFog.near) : base.near;
  fogGoal.far = flying ? Math.max(base.far, lite ? flightFog.liteFar : flightFog.far) : base.far;
  return fogGoal;
}

/**
 * Hides a station (and lets its frame callback bail out early) once the
 * camera is far away — beyond the fog it would be invisible anyway. A
 * flight's destination draws from further out, ahead of the fog.
 */
export function stationInRange(group: Object3D | null, camera: Camera, key: StationKey) {
  if (!group) return false;
  stationVector.fromArray(stationPositions[key]);
  const range =
    key === worldStore.flight.to && pageFlight() ? Math.max(viewRange, flightRange) : viewRange;
  const near = camera.position.distanceToSquared(stationVector) < range * range;
  group.visible = near;
  return near;
}
