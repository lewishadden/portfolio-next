'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing';
import { ChromaticAberrationEffect } from 'postprocessing';
import { Vector2 } from 'three';

import { palettes } from './utils';
import { worldStore } from './worldStore';

import type { WorldTheme } from './utils';

function updateAberration(effect: ChromaticAberrationEffect | null, velocity: number) {
  if (!effect) return;
  const amount = Math.min(velocity / 40, 1.2) * 0.0035;
  effect.offset.set(amount, amount * 0.6);
}

/** Bloom + velocity-driven chromatic aberration + vignette */
export function Effects({ theme, lite }: { theme: WorldTheme; lite: boolean }) {
  const palette = palettes[theme];
  const aberrationRef = useRef<ChromaticAberrationEffect>(null);
  const offset = useMemo(() => new Vector2(0, 0), []);

  useFrame(() => updateAberration(aberrationRef.current, worldStore.velocity));

  if (lite) {
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
