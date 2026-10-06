'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing';
import { BloomEffect, ChromaticAberrationEffect } from 'postprocessing';
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

/** Bloom's working resolution, as a share of the screen: resizes its buffers, nothing else */
function setBloomScale(effect: BloomEffect | null, scale: number) {
  if (effect && effect.resolution.scale !== scale) effect.resolution.scale = scale;
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
 * Post-processing. The same passes run on every quality tier (bloom,
 * velocity-driven chromatic aberration, vignette), so a tier change never
 * rebuilds the composer, recompiles a shader, or shifts the exposure: a
 * tier that dropped bloom used to read as the whole world flickering
 * between bright and dim. The tiers differ in cost only: the pixel ratio
 * (WorldCanvas), bloom's internal resolution (a quarter on low, set
 * through the effect so nothing is recreated) and aberration held at
 * zero below high.
 */
export function Effects({ theme, tier }: { theme: WorldTheme; tier: QualityTier }) {
  const palette = palettes[theme];
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const track = useWarmupTask();
  const composerRef = useRef<EffectComposerImpl>(null);
  const bloomRef = useRef<BloomEffect>(null);
  const aberrationRef = useRef<ChromaticAberrationEffect>(null);
  const offset = useMemo(() => new Vector2(0, 0), []);
  const aberration = tier === 'high';

  useFrame(() => updateAberration(aberrationRef.current, aberration ? worldStore.velocity : 0));

  useEffect(() => {
    setBloomScale(bloomRef.current, tier === 'low' ? 0.25 : 0.5);
  }, [tier]);

  // Precompile the passes whenever the pass list is (re)built: on mount and
  // on a theme change (new bloom threshold)
  useEffect(() => {
    track(composerReady(composerRef).then((composer) => precompileComposer(gl, composer, camera)));
  }, [palette.bloomThreshold, gl, camera, track]);

  return (
    <EffectComposer ref={composerRef} multisampling={0}>
      <Bloom
        ref={bloomRef}
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
