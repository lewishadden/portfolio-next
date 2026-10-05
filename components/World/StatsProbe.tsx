'use client';

import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

import { statsOverlay } from 'components/StatsOverlay/statsStore';

import { worldStore } from './worldStore';

import type { WebGLRenderer } from 'three';
import type { StationKey } from './stations';

/** Renderer settings are changed through a helper (hook results are read-only in components) */
function setAutoReset(gl: WebGLRenderer, on: boolean) {
  gl.info.autoReset = on;
}

/**
 * Feeds the stats overlay. Renderer counters normally reset on every
 * render() call, and a frame here is several (shadows, the scene, each
 * post-processing pass), so they accumulate over the frame instead and
 * are read and reset after the composer has drawn (priority 2).
 */
export function StatsProbe({ station }: { station: StationKey }) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    setAutoReset(gl, false);
    return () => setAutoReset(gl, true);
  }, [gl]);

  useFrame(({ size, viewport }) => {
    if (statsOverlay.get()) {
      const { render, memory, programs } = gl.info;
      const stats = worldStore.stats;
      stats.calls = render.calls;
      stats.triangles = render.triangles;
      stats.points = render.points;
      stats.lines = render.lines;
      stats.geometries = memory.geometries;
      stats.textures = memory.textures;
      stats.programs = programs?.length ?? 0;
      stats.width = size.width;
      stats.height = size.height;
      stats.dpr = viewport.dpr;
      stats.station = station;
    }
    gl.info.reset();
  }, 2);

  return null;
}
