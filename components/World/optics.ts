import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { MathUtils, Uniform, Vector2, Vector3 } from 'three';

import { cameraMotion } from './MotionProbe';
import { sunDirection } from './sky';

import type { Camera } from 'three';

/* ------------------------------------------------------------------
   The camera's optics, as post-processing effects (see Effects.tsx).

   OpticsEffect: everything that samples the frame along lines. At speed,
   a radial streak blur out from the point the camera is heading for (the
   jump to lightspeed) with colour fringes towards the edges, and light
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
   ------------------------------------------------------------------ */

const opticsShader = /* glsl */ `
  uniform float uWarp;
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
      vec2 reach = (uv - uFocus) * uWarp * 0.065;
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

export class OpticsEffect extends Effect {
  constructor() {
    super('OpticsEffect', opticsShader, {
      attributes: EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ['uWarp', new Uniform(0)],
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

const sunPoint = new Vector3();

/** How far a point (uv) lies outside the screen, 0 on it */
const outside = (u: number, v: number) =>
  Math.hypot(Math.max(-u, u - 1, 0), Math.max(-v, v - 1, 0));

/**
 * Per frame: the streak blur and fringes follow the camera's speed (fringes
 * only on the top tier, as before), aimed at the point it is heading for;
 * the shafts follow the sun on screen (top tier and the dark sky only)
 */
export function updateOptics(
  effect: OpticsEffect,
  camera: Camera,
  { fringes, shafts }: { fringes: boolean; shafts: boolean }
) {
  const uniforms = effect.uniforms;
  const speed = cameraMotion.speed;
  // Only heading into the view: drifting sideways or backwards doesn't streak
  const warp =
    MathUtils.smoothstep(speed, 40, 140) * MathUtils.smoothstep(cameraMotion.ahead, 0.15, 0.6);
  uniforms.get('uWarp')!.value = warp;
  (uniforms.get('uFocus')!.value as Vector2).set(
    cameraMotion.focusX * 0.5 + 0.5,
    cameraMotion.focusY * 0.5 + 0.5
  );
  uniforms.get('uFringe')!.value = fringes ? Math.min(speed / 40, 1.2) * 0.007 : 0;

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
