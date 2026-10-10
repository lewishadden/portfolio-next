import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { Color, MathUtils, Uniform, Vector2, Vector3, Vector4 } from 'three';

import { motionLevel } from '@/utils/motion';

import { cameraMotion } from './MotionProbe';
import { sunDirection } from './sky';
import { pageCopyShown } from './stations';
import { worldMode } from './worldMode';
import { worldStore } from './worldStore';

import type { Camera } from 'three';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   The camera's optics, as post-processing effects (see Effects.tsx).

   OpticsEffect: everything that samples the frame along lines. At speed,
   while the camera travels (a flight, free roam), a radial streak blur out
   from the point it is heading for (the jump to lightspeed) with colour
   fringes towards the edges, and light
   shafts fanning out from the sun when it's in view (top tier only). All
   of it switches off by uniform, never by rebuilding a shader: at rest it
   is a single texture read.

   HighlightRolloffEffect: the tone curve. Below the knee colours are left
   exactly as they are (the project screens and anything UI-like keep their
   own colours); above it highlights roll off smoothly instead of clipping,
   and light too hot to show desaturates towards white, so glowing cores
   read as hot rather than as flat, saturated discs.

   GrainEffect: fine animated film grain, even in perceived brightness (it
   also dithers the sky's long gradients).

   ReadingGuardEffect: keeps the page's copy readable over the world.
   Behind each text block the page marks ([data-reading], measured into
   worldStore.readingRects), it limits the world's luminance so the text
   keeps 4.5:1 (3:1 for large text): on the dark sky it caps it, on the
   light sky it lifts it, scaling RGB so the hue holds, feathered ~40px
   past each block. It lets go while a flight cruises (no copy on show)
   and outside page mode.
   ------------------------------------------------------------------ */

const opticsShader = /* glsl */ `
  uniform float uWarp;
  uniform float uReach;
  uniform vec2 uFocus;
  uniform float uFringe;
  uniform vec2 uSun;
  uniform float uShafts;
  uniform vec3 uSunTint;

  // Interleaved gradient noise: offsets each pixel's taps so the streaks
  // and shafts read as smooth rather than as stacked copies
  float jitterAt(vec2 pixel) {
    return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  }

  vec3 split(vec2 at, vec2 fringe) {
    return vec3(
      texture2D(inputBuffer, at + fringe).r,
      texture2D(inputBuffer, at).g,
      texture2D(inputBuffer, at - fringe).b
    );
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb;
    float jitter = jitterAt(gl_FragCoord.xy);
    vec2 fromCentre = uv - 0.5;
    // Fringes grow towards the edges and stay out of the middle
    vec2 fringe = fromCentre * uFringe * smoothstep(0.25, 1.0, 2.0 * length(fromCentre));

    if (uWarp > 0.001) {
      // Each pixel gathers the light from between it and the heading point
      vec2 reach = (uv - uFocus) * uWarp * 0.065 * uReach;
      vec3 sum = vec3(0.0);
      for (int i = 0; i < 6; i++) {
        float t = (float(i) + jitter) / 6.0;
        sum += split(uv - reach * t, fringe);
      }
      color = sum / 6.0;
    } else if (uFringe > 0.0) {
      color = split(uv, fringe);
    }

    if (uShafts > 0.001) {
      vec2 toSun = uSun - uv;
      vec3 rays = vec3(0.0);
      for (int i = 0; i < 10; i++) {
        float t = (float(i) + jitter) / 10.0;
        vec3 tap = texture2D(inputBuffer, clamp(uv + toSun * t * 0.7, 0.0, 1.0)).rgb;
        float luma = dot(tap, vec3(0.2126, 0.7152, 0.0722));
        rays += tap * smoothstep(0.5, 1.6, luma) * (1.0 - 0.6 * t);
      }
      float falloff = exp(-1.8 * length((uv - uSun) * vec2(aspect, 1.0)));
      color += rays * (0.1 * uShafts * falloff) * uSunTint;
    }

    outputColor = vec4(color, inputColor.a);
  }
`;

const rolloffShader = /* glsl */ `
  uniform float uKnee;
  uniform float uHeat;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = max(inputColor.rgb, 0.0);
    float peak = max(max(color.r, color.g), color.b);
    if (peak > uKnee) {
      // Compress the brightest channel from the knee towards 1 (smooth at
      // the knee), scaling the others with it so the hue holds…
      float room = 1.0 - uKnee;
      float mapped = uKnee + room * (1.0 - exp(-(peak - uKnee) / room));
      color *= mapped / peak;
      // …and let light that would have clipped bleed towards white
      float heat = 1.0 - 1.0 / (1.0 + max(peak - 1.0, 0.0) * uHeat);
      color = mix(color, vec3(mapped), 0.85 * heat);
    }
    outputColor = vec4(color, inputColor.a);
  }
`;

const grainShader = /* glsl */ `
  uniform float uAmount;

  float grainAt(vec2 pixel) {
    return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // A new pattern every frame, laid on in roughly perceptual space so it
    // is as fine in the shadows as in the highlights
    vec2 shift = vec2(fract(time * 7.31), fract(time * 3.17)) * 113.0;
    float noise = grainAt(gl_FragCoord.xy + shift) - 0.5;
    vec3 perceived = sqrt(max(inputColor.rgb, 0.0)) + noise * uAmount;
    outputColor = vec4(perceived * perceived, inputColor.a);
  }
`;

/** How many text blocks the guard protects (worldStore.readingRects holds this many) */
const guardedBlocks = 6;

const readingGuardShader = /* glsl */ `
  uniform vec4 uRects[${guardedBlocks}];
  uniform float uLarge[${guardedBlocks}];
  uniform float uCount;
  uniform float uFeather;
  uniform vec2 uCeil;
  uniform vec2 uFloor;
  uniform float uStrength;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = max(inputColor.rgb, 0.0);
    if (uStrength <= 0.0 || uCount < 0.5) {
      outputColor = vec4(color, inputColor.a);
      return;
    }
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec2 pixel = uv * resolution;
    float dim = 1.0;
    float lift = 0.0;
    for (int i = 0; i < ${guardedBlocks}; i++) {
      if (float(i) >= uCount) break;
      vec4 rect = uRects[i] * resolution.xyxy;
      vec2 outside = max(max(rect.xy - pixel, pixel - rect.zw), 0.0);
      float weight = uStrength * (1.0 - smoothstep(0.0, uFeather, length(outside)));
      if (weight <= 0.0) continue;
      float ceiling = mix(uCeil.x, uCeil.y, uLarge[i]);
      dim = min(dim, mix(1.0, min(1.0, ceiling / max(luma, 1e-5)), weight));
      lift = max(lift, weight * mix(uFloor.x, uFloor.y, uLarge[i]));
    }
    // Dark sky: scale the light down to the ceiling
    color *= dim;
    luma *= dim;
    // Light sky: scale up to the floor where the colour has room, then
    // towards white for whatever scaling can't reach
    if (lift > luma) {
      float peak = max(max(color.r, color.g), color.b);
      float scale = min(lift / max(luma, 1e-4), 1.0 / max(peak, 1e-4));
      color *= scale;
      luma *= scale;
      if (lift > luma) color = mix(color, vec3(1.0), (lift - luma) / max(1.0 - luma, 1e-4));
    }
    outputColor = vec4(color, inputColor.a);
  }
`;

export class OpticsEffect extends Effect {
  /**
   * 0..1, eased: whether the camera is travelling (a flight, or free roam's
   * thrust) rather than following the page's scroll
   */
  travel = 0;

  constructor() {
    super('OpticsEffect', opticsShader, {
      attributes: EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ['uWarp', new Uniform(0)],
        ['uReach', new Uniform(1)],
        ['uFocus', new Uniform(new Vector2(0.5, 0.5))],
        ['uFringe', new Uniform(0)],
        ['uSun', new Uniform(new Vector2(-1, -1))],
        ['uShafts', new Uniform(0)],
        ['uSunTint', new Uniform(new Vector3(1, 0.86, 0.7))],
      ]),
    });
  }
}

export class HighlightRolloffEffect extends Effect {
  constructor({ knee, heat = 0.6 }: { knee: number; heat?: number }) {
    super('HighlightRolloffEffect', rolloffShader, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ['uKnee', new Uniform(knee)],
        ['uHeat', new Uniform(heat)],
      ]),
    });
  }
}

export class GrainEffect extends Effect {
  constructor({ amount }: { amount: number }) {
    super('GrainEffect', grainShader, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([['uAmount', new Uniform(amount)]]),
    });
  }
}

export class ReadingGuardEffect extends Effect {
  /**
   * How firmly it holds, eased (0 while a new page's copy is held back or
   * outside page mode). Starts firm, so a canvas started under copy that is
   * already showing (3D switched back on) guards it from the first frame
   */
  strength = 1;

  constructor() {
    super('ReadingGuardEffect', readingGuardShader, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ['uRects', new Uniform(Array.from({ length: guardedBlocks }, () => new Vector4()))],
        ['uLarge', new Uniform(new Array<number>(guardedBlocks).fill(0))],
        ['uCount', new Uniform(0)],
        ['uFeather', new Uniform(40)],
        ['uCeil', new Uniform(new Vector2(100, 100))],
        ['uFloor', new Uniform(new Vector2(0, 0))],
        ['uStrength', new Uniform(0)],
      ]),
    });
  }
}

/** Relative luminance (WCAG) of a CSS colour: three's Color holds it linear */
const luminanceOf = (css: string) => {
  const { r, g, b } = new Color(css);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG's ratios, with 3% to spare for the vignette and grain laid on after the guard */
const ratios = { normal: 4.5 * 1.03, large: 3 * 1.03 };
/** The brightest the world may be behind light text, for a ratio */
const ceilingFor = (text: string, ratio: number) => (luminanceOf(text) + 0.05) / ratio - 0.05;
/** The dimmest it may be behind dark text */
const floorFor = (text: string, ratio: number) => ratio * (luminanceOf(text) + 0.05) - 0.05;

/**
 * The guard's limits per theme, from the text the marked blocks use
 * (theme-variables.scss): the dimmest normal-size text on the dark sky is
 * the violet accent (--accent-primary), the dimmest large text the
 * headings' gradient at #818cf8; on the light sky the lightest is the cyan
 * accent (--accent-secondary) in eyebrows and highlights. Muted text
 * (--text-muted) would need a near-black backdrop (luminance ~0.005), so it
 * isn't one of them and must not sit inside a [data-reading] block: the
 * station readout and the hero's stat labels use --text-secondary for that
 */
const guardLimits: Record<WorldTheme, { ceiling: [number, number]; floor: [number, number] }> = {
  dark: {
    ceiling: [ceilingFor('#a78bfa', ratios.normal), ceilingFor('#818cf8', ratios.large)],
    floor: [0, 0],
  },
  light: {
    ceiling: [100, 100],
    floor: [floorFor('#0e7490', ratios.normal), floorFor('#0e7490', ratios.large)],
  },
};

/** CSS px the guard feathers out past each block */
const guardFeather = 40;

/**
 * Per frame: hands the guard the blocks the page measured (viewport
 * fractions, y down) as canvas UVs (y up), the theme's limits and its
 * strength. It lets go only while the page's copy isn't on screen: while a
 * flight to a new page holds that copy back (until its final approach), and
 * outside page mode (the tour, free roam and the return from them hide the
 * page). The warp in keeps it, as its page is already showing. Eases over
 * ~0.2s; at once when nothing may move
 */
export function updateReadingGuard(
  effect: ReadingGuardEffect,
  theme: WorldTheme,
  size: { width: number; height: number },
  pixelRatio: number,
  delta: number
) {
  const uniforms = effect.uniforms;
  const goal = worldMode.get().mode === 'page' && pageCopyShown() ? 1 : 0;
  effect.strength =
    motionLevel() === 'still'
      ? goal
      : MathUtils.damp(effect.strength, goal, 12, Math.min(delta, 0.1));
  if (Math.abs(effect.strength - goal) < 1e-3) effect.strength = goal;
  uniforms.get('uStrength')!.value = effect.strength;

  const count = worldStore.readingCount;
  uniforms.get('uCount')!.value = count;
  const rects = uniforms.get('uRects')!.value as Vector4[];
  const large = uniforms.get('uLarge')!.value as number[];
  // The page measures against the window; the canvas fills the layout viewport
  const sx = window.innerWidth / Math.max(size.width, 1);
  const sy = window.innerHeight / Math.max(size.height, 1);
  const from = worldStore.readingRects;
  for (let i = 0; i < count; i++) {
    rects[i].set(
      from[i * 4] * sx,
      1 - from[i * 4 + 3] * sy,
      from[i * 4 + 2] * sx,
      1 - from[i * 4 + 1] * sy
    );
    large[i] = worldStore.readingLarge[i];
  }
  // Device pixels, as the shader measures
  uniforms.get('uFeather')!.value = guardFeather * pixelRatio;
  const limits = guardLimits[theme];
  (uniforms.get('uCeil')!.value as Vector2).set(...limits.ceiling);
  (uniforms.get('uFloor')!.value as Vector2).set(...limits.floor);
}

const sunPoint = new Vector3();

/** How far a point (uv) lies outside the screen, 0 on it */
const outside = (u: number, v: number) =>
  Math.hypot(Math.max(-u, u - 1, 0), Math.max(-v, v - 1, 0));

/**
 * Per frame: the streak blur and fringes follow the camera's speed (fringes
 * only on the top tier, as before), aimed at the point it is heading for,
 * but only while it travels: a flight between stations or free roam's
 * thrust. Following the page's scroll (End and Home on a long page) never
 * reads as lightspeed. The shafts follow the sun on screen (top tier and
 * the dark sky only). On the light sky the streaks reach about half as far:
 * smeared over a bright frame, full-length streaks washed everything out
 */
export function updateOptics(
  effect: OpticsEffect,
  camera: Camera,
  { fringes, shafts, light }: { fringes: boolean; shafts: boolean; light: boolean },
  delta: number
) {
  const uniforms = effect.uniforms;
  const speed = cameraMotion.speed;
  const travelling = worldStore.flight.active || worldMode.get().mode === 'explore';
  // Eased out, so a flight's last streaks don't cut off as it lands
  effect.travel = travelling ? 1 : Math.max(0, effect.travel - Math.min(delta, 0.1) / 0.3);
  // Only heading into the view: drifting sideways or backwards doesn't streak
  const warp =
    MathUtils.smoothstep(speed, 40, 140) *
    MathUtils.smoothstep(cameraMotion.ahead, 0.15, 0.6) *
    effect.travel;
  uniforms.get('uWarp')!.value = warp;
  uniforms.get('uReach')!.value = light ? 0.55 : 1;
  (uniforms.get('uFocus')!.value as Vector2).set(
    cameraMotion.focusX * 0.5 + 0.5,
    cameraMotion.focusY * 0.5 + 0.5
  );
  uniforms.get('uFringe')!.value = fringes ? Math.min(speed / 40, 1.2) * 0.007 * effect.travel : 0;

  let strength = 0;
  if (shafts) {
    sunPoint.copy(camera.position).addScaledVector(sunDirection, 1000).project(camera);
    // Behind the camera, project() mirrors it: no shafts
    const facing = sunPoint.z < 1;
    const u = sunPoint.x * 0.5 + 0.5;
    const v = sunPoint.y * 0.5 + 0.5;
    (uniforms.get('uSun')!.value as Vector2).set(u, v);
    strength = facing ? 1 - MathUtils.smoothstep(outside(u, v), 0, 0.35) : 0;
  }
  uniforms.get('uShafts')!.value = strength;
}

/** The tone curve's knee and the grain's strength for a theme */
export function tuneGrade(
  rolloff: HighlightRolloffEffect,
  grain: GrainEffect,
  { knee, grain: amount }: { knee: number; grain: number }
) {
  rolloff.uniforms.get('uKnee')!.value = knee;
  grain.uniforms.get('uAmount')!.value = amount;
}
