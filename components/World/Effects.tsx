'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing';
import { ChromaticAberrationEffect } from 'postprocessing';
import { Vector2 } from 'three';

import { palettes } from './utils';
import { precompileComposer, useWarmupTask } from './warmup';
import { worldStore } from './worldStore';

import type { EffectComposer as EffectComposerImpl } from 'postprocessing';
import type { QualityTier } from './quality';
import type { WorldTheme } from './utils';

function updateAberration(effect: ChromaticAberrationEffect | null, velocity: number) {
  if (!effect) return;
  const amount = Math.min(velocity / 40, 1.2) * 0.0035;
  effect.offset.set(amount, amount * 0.6);
}

/** Resolves once the composer has built its passes (they're added a render after mount) */
function composerReady(ref: { current: EffectComposerImpl | null }) {
  return new Promise<EffectComposerImpl>((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      const composer = ref.current;
      if (composer && composer.passes.length > 1) resolve(composer);
      else if (performance.now() - started > 3000) reject(new Error('composer not ready'));
      else setTimeout(check, 16);
    };
    check();
  });
}

/**
 * Post-processing per quality tier. One composer serves every tier: the scene
 * is always drawn into its input buffer, so a tier change never invalidates
 * the scene's compiled shaders.
 * high — bloom + velocity-driven chromatic aberration + vignette;
 * medium — the same passes (aberration held at zero); the saving is the
 * lower pixel ratio; low — vignette only, no bloom.
 * Bloom's constructor args are identical on high and medium, so switching
 * between them doesn't rebuild (and recompile) anything.
 */
export function Effects({ theme, tier }: { theme: WorldTheme; tier: QualityTier }) {
  const palette = palettes[theme];
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const track = useWarmupTask();
  const composerRef = useRef<EffectComposerImpl>(null);
  const aberrationRef = useRef<ChromaticAberrationEffect>(null);
  const offset = useMemo(() => new Vector2(0, 0), []);
  const bloom = tier !== 'low';
  const aberration = tier === 'high';

  useFrame(() => updateAberration(aberrationRef.current, aberration ? worldStore.velocity : 0));

  // Precompile the passes whenever the pass list is (re)built: on mount, on a
  // theme change (new bloom threshold) and when bloom is switched on or off
  useEffect(() => {
    track(composerReady(composerRef).then((composer) => precompileComposer(gl, composer, camera)));
  }, [bloom, palette.bloomThreshold, gl, camera, track]);

  return (
    <EffectComposer ref={composerRef} multisampling={0}>
      {bloom && (
        <Bloom
          mipmapBlur
          intensity={palette.bloom}
          luminanceThreshold={palette.bloomThreshold}
          luminanceSmoothing={0.25}
          radius={0.75}
        />
      )}
      {bloom && (
        <ChromaticAberration
          ref={aberrationRef}
          offset={offset}
          radialModulation
          modulationOffset={0.25}
        />
      )}
      <Vignette darkness={palette.vignette} offset={0.28} />
    </EffectComposer>
  );
}
