'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
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
  ReadingGuardEffect,
  tuneGrade,
  updateOptics,
  updateReadingGuard,
} from './optics';
import { palettes } from './utils';
import { tierRank, tierSettings } from './quality';
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

interface Chain {
  bloom: SelectiveBloomEffect;
  optics: OpticsEffect;
  rolloff: HighlightRolloffEffect;
  guard: ReadingGuardEffect;
  vignette: VignetteEffect;
  grain: GrainEffect;
  passes: EffectPass[];
}

/**
 * The theme's grade, set in place: bloom strength and threshold, the
 * vignette, the tone curve's knee and the grain. All uniforms, so a theme
 * change neither rebuilds a pass nor recompiles a shader
 */
function themeChain(chain: Chain, theme: WorldTheme) {
  const palette = palettes[theme];
  chain.bloom.intensity = palette.bloom;
  chain.bloom.luminanceMaterial.threshold = palette.bloomThreshold;
  chain.vignette.darkness = palette.vignette;
  tuneGrade(chain.rolloff, chain.grain, grades[theme]);
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
 *    (highlights roll off and burn towards white instead of clipping), the
 *    reading guard (the world behind the page's copy held to a luminance
 *    the text reads against) and the vignette.
 * 3. SMAA on the finished image (the renderer itself is not antialiased:
 *    thin rings, trusses and orbit lines shimmered without it), then grain.
 *
 * The tiers differ in cost only: the pixel ratio (WorldCanvas), bloom's
 * internal resolution (quality.ts: a quarter on low, 0.6 on ultra, set
 * through the effect so nothing is recreated), and fringes and sun shafts
 * held at zero below high.
 * The chain is built once: a theme change sets its grade in place
 * (themeChain), so the passes keep their keys and nothing recompiles.
 */
export function Effects({ theme, tier }: { theme: WorldTheme; tier: QualityTier }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const track = useWarmupTask();
  const composerRef = useRef<EffectComposerImpl>(null);
  // Fringes and sun shafts from high up
  const top = tierRank(tier) >= tierRank('high');

  // Built once: a theme change retunes it in place (themeChain)
  const chain = useMemo<Chain>(() => {
    const bloom = new SelectiveBloomEffect(scene, camera, {
      mipmapBlur: true,
      intensity: palettes.dark.bloom,
      luminanceThreshold: palettes.dark.bloomThreshold,
      luminanceSmoothing: 0.25,
      radius: 0.75,
    });
    bloom.inverted = true;
    bloom.selection.layer = bloomMaskLayer;
    const optics = new OpticsEffect();
    const rolloff = new HighlightRolloffEffect({ knee: grades.dark.knee });
    const guard = new ReadingGuardEffect();
    const vignette = new VignetteEffect({ darkness: palettes.dark.vignette, offset: 0.28 });
    const smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM });
    const grain = new GrainEffect({ amount: grades.dark.grain });
    return {
      bloom,
      optics,
      rolloff,
      guard,
      vignette,
      grain,
      passes: [
        new EffectPass(camera, bloom),
        new EffectPass(camera, optics, rolloff, guard, vignette),
        new EffectPass(camera, smaa, grain),
      ],
    };
  }, [scene, camera]);
  // Disposing a pass disposes its effects
  useEffect(() => () => chain.passes.forEach((pass) => pass.dispose()), [chain]);

  // Before the first frame draws, and before the next one after a change
  useLayoutEffect(() => themeChain(chain, theme), [chain, theme]);

  const masking = useMemo(() => ({ bloom: chain.bloom, version: -1 }), [chain]);
  useFrame(({ size }, delta) => {
    followMasks(masking);
    updateReadingGuard(chain.guard, theme, size, gl.getPixelRatio(), delta);
    updateOptics(
      chain.optics,
      camera,
      { fringes: top, shafts: top && theme === 'dark', light: theme === 'light' },
      delta
    );
  });

  useEffect(() => {
    setBloomScale(chain.bloom, tierSettings[tier].bloomScale);
  }, [chain, tier]);

  // Precompile the passes when the chain is built (once)
  useEffect(() => {
    track(
      composerReady(composerRef).then((composer) => precompileComposer(gl, composer, camera, scene))
    );
  }, [chain, gl, camera, scene, track]);

  return (
    <EffectComposer ref={composerRef} multisampling={0}>
      {chain.passes.map((pass, i) => (
        <primitive key={i} object={pass} />
      ))}
    </EffectComposer>
  );
}
