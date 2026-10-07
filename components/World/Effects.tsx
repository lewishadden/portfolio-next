'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import {
  EffectPass,
  SMAAEffect,
  SMAAPreset,
  SelectiveBloomEffect,
  VignetteEffect,
} from 'postprocessing';

import { bloomMaskLayer, bloomMasks, bloomMasksShown, bloomMasksVersion } from './bloomMask';
import {
  GrainEffect,
  HighlightRolloffEffect,
  OpticsEffect,
  tuneGrade,
  updateOptics,
} from './optics';
import { palettes } from './utils';
import { precompileComposer, useWarmupTask } from './warmup';

import type { EffectComposer as EffectComposerImpl } from 'postprocessing';
import type { QualityTier } from './quality';
import type { WorldTheme } from './utils';

/** The tone curve's knee and the grain, per theme: daylight's bright sky stays put under a higher knee */
const grades: Record<WorldTheme, { knee: number; grain: number }> = {
  dark: { knee: 0.88, grain: 0.028 },
  light: { knee: 0.96, grain: 0.014 },
};

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
 * Post-processing, in three passes, the same on every quality tier, so a
 * tier change never rebuilds the composer, recompiles a shader or shifts
 * the exposure (a tier that dropped bloom used to read as the whole world
 * flickering between bright and dim):
 *
 * 1. Bloom. It leaves out whatever a bloom mask covers (the project
 *    screens, so their pages show at their own brightness): an inverted
 *    selective bloom, whose depth pass only draws the masks and only runs
 *    while there are some.
 * 2. The optics (optics.ts: the streak blur and fringes at speed, the sun's
 *    shafts), on the bloomed, still unclipped frame; then the tone curve
 *    (highlights roll off and burn towards white instead of clipping) and
 *    the vignette.
 * 3. SMAA on the finished image (the renderer itself is not antialiased:
 *    thin rings, trusses and orbit lines shimmered without it), then grain.
 *
 * The tiers differ in cost only: the pixel ratio (WorldCanvas), bloom's
 * internal resolution (a quarter on low, set through the effect so nothing
 * is recreated), and fringes and sun shafts held at zero below high.
 */
export function Effects({ theme, tier }: { theme: WorldTheme; tier: QualityTier }) {
  const palette = palettes[theme];
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const track = useWarmupTask();
  const composerRef = useRef<EffectComposerImpl>(null);
  const top = tier === 'high';

  const chain = useMemo(() => {
    const bloom = new SelectiveBloomEffect(scene, camera, {
      mipmapBlur: true,
      intensity: palette.bloom,
      luminanceThreshold: palette.bloomThreshold,
      luminanceSmoothing: 0.25,
      radius: 0.75,
    });
    bloom.inverted = true;
    bloom.selection.layer = bloomMaskLayer;
    const optics = new OpticsEffect();
    const rolloff = new HighlightRolloffEffect({ knee: grades.dark.knee });
    const vignette = new VignetteEffect({ darkness: palette.vignette, offset: 0.28 });
    const smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM });
    const grain = new GrainEffect({ amount: grades.dark.grain });
    return {
      bloom,
      optics,
      rolloff,
      grain,
      passes: [
        new EffectPass(camera, bloom),
        new EffectPass(camera, optics, rolloff, vignette),
        new EffectPass(camera, smaa, grain),
      ],
    };
  }, [scene, camera, palette.bloom, palette.bloomThreshold, palette.vignette]);
  // Disposing a pass disposes its effects
  useEffect(() => () => chain.passes.forEach((pass) => pass.dispose()), [chain]);

  useEffect(() => tuneGrade(chain.rolloff, chain.grain, grades[theme]), [chain, theme]);

  const masking = useMemo(() => ({ bloom: chain.bloom, version: -1 }), [chain]);
  useFrame(() => {
    followMasks(masking);
    updateOptics(chain.optics, camera, { fringes: top, shafts: top && theme === 'dark' });
  });

  useEffect(() => {
    setBloomScale(chain.bloom, tier === 'low' ? 0.25 : 0.5);
  }, [chain, tier]);

  // Precompile the passes whenever the pass list is (re)built: on mount and
  // on a theme change (new bloom threshold)
  useEffect(() => {
    track(
      composerReady(composerRef).then((composer) => precompileComposer(gl, composer, camera, scene))
    );
  }, [chain, gl, camera, scene, track]);

  return (
    <EffectComposer ref={composerRef} multisampling={0}>
      {chain.passes.map((pass, i) => (
        <primitive key={`${theme}-${i}`} object={pass} />
      ))}
    </EffectComposer>
  );
}
