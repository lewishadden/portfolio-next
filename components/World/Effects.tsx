'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing';
import { ChromaticAberrationEffect } from 'postprocessing';
import { Vector2 } from 'three';

import { palettes } from './utils';
import { worldStore } from './worldStore';

import type { QualityTier } from './quality';
import type { WorldTheme } from './utils';

function updateAberration(effect: ChromaticAberrationEffect | null, velocity: number) {
  if (!effect) return;
  const amount = Math.min(velocity / 40, 1.2) * 0.0035;
  effect.offset.set(amount, amount * 0.6);
}

/**
 * Post-processing per quality tier:
 * high — bloom + velocity-driven chromatic aberration + vignette;
 * medium — lighter bloom + vignette; low — none (plain render, cheapest).
 */
export function Effects({ theme, tier }: { theme: WorldTheme; tier: QualityTier }) {
  const palette = palettes[theme];
  const aberrationRef = useRef<ChromaticAberrationEffect>(null);
  const offset = useMemo(() => new Vector2(0, 0), []);

  useFrame(() => updateAberration(aberrationRef.current, worldStore.velocity));

  if (tier === 'low') return null;

  if (tier === 'medium') {
    return (
      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          intensity={palette.bloom * 0.8}
          luminanceThreshold={palette.bloomThreshold}
          luminanceSmoothing={0.2}
        />
        <Vignette darkness={palette.vignette} offset={0.3} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        intensity={palette.bloom}
        luminanceThreshold={palette.bloomThreshold}
        luminanceSmoothing={0.25}
        radius={0.75}
      />
      <ChromaticAberration
        ref={aberrationRef}
        offset={offset}
        radialModulation
        modulationOffset={0.25}
      />
      <Vignette darkness={palette.vignette} offset={0.28} />
    </EffectComposer>
  );
}
