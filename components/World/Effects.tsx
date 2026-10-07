'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing';
import { ChromaticAberrationEffect, SelectiveBloomEffect } from 'postprocessing';
import { Vector2 } from 'three';

import { bloomMaskLayer, bloomMasks, bloomMasksShown, bloomMasksVersion } from './bloomMask';
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
function setBloomScale(effect: SelectiveBloomEffect, scale: number) {
  if (effect.resolution.scale !== scale) effect.resolution.scale = scale;
}

/**
 * Keeps the bloom's selection in step with the bloom masks on show
 * (bloomMask.ts). With none on show it's empty, and the bloom skips its
 * mask passes (drawing the masks' depth, and masking the frame with it)
 */
function followMasks(masking: { bloom: SelectiveBloomEffect; version: number }) {
  const version = bloomMasksShown() ? bloomMasksVersion() : -1;
  if (version === masking.version) return;
  masking.version = version;
  if (version < 0) masking.bloom.selection.clear();
  else masking.bloom.selection.set(bloomMasks());
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
 * zero below high. Bloom leaves out whatever a bloom mask covers (the
 * project screens, so their pages show at their own brightness): an
 * inverted selective bloom, whose depth pass only draws the masks and only
 * runs while there are some.
 */
export function Effects({ theme, tier }: { theme: WorldTheme; tier: QualityTier }) {
  const palette = palettes[theme];
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const track = useWarmupTask();
  const composerRef = useRef<EffectComposerImpl>(null);
  const aberrationRef = useRef<ChromaticAberrationEffect>(null);
  const offset = useMemo(() => new Vector2(0, 0), []);
  const aberration = tier === 'high';

  useFrame(() => updateAberration(aberrationRef.current, aberration ? worldStore.velocity : 0));

  const bloom = useMemo(() => {
    const effect = new SelectiveBloomEffect(scene, camera, {
      mipmapBlur: true,
      intensity: palette.bloom,
      luminanceThreshold: palette.bloomThreshold,
      luminanceSmoothing: 0.25,
      radius: 0.75,
    });
    effect.inverted = true;
    effect.selection.layer = bloomMaskLayer;
    return effect;
  }, [scene, camera, palette.bloom, palette.bloomThreshold]);
  useEffect(() => () => bloom.dispose(), [bloom]);
  const masking = useMemo(() => ({ bloom, version: -1 }), [bloom]);
  useFrame(() => followMasks(masking));

  useEffect(() => {
    setBloomScale(bloom, tier === 'low' ? 0.25 : 0.5);
  }, [bloom, tier]);

  // Precompile the passes whenever the pass list is (re)built: on mount and
  // on a theme change (new bloom threshold)
  useEffect(() => {
    track(
      composerReady(composerRef).then((composer) => precompileComposer(gl, composer, camera, scene))
    );
  }, [palette.bloomThreshold, gl, camera, scene, track]);

  return (
    <EffectComposer ref={composerRef} multisampling={0}>
      <primitive object={bloom} />
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
