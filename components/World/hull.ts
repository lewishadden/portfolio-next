import { Mesh, MeshStandardMaterial } from 'three';

import { stationPower } from './power';

import type { Object3D } from 'three';
import type { StationKey } from './routes';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Station hulls (image-to-3D, PBR textures). Their window lights and
   accent strips are painted into the colour texture, so they would
   only ever be as bright as white paint. This derives an emissive term
   from the colour itself: very bright warm pixels (windows) and
   saturated blue-side pixels (the cyan / violet strips) glow, enough
   for the bloom pass to pick them up; neutral panels and gold foil don't.
   Each hull follows its station's power (power.tsx): the strips with its
   charge, and the windows a patch at a time (each patch of the texture
   has its own threshold) as the share lit rises, so they flick on.
   ------------------------------------------------------------------ */

const glowChunk = /* glsl */ `
#include <emissivemap_fragment>
{
  vec3 c = diffuseColor.rgb;
  float hi = max(max(c.r, c.g), c.b);
  float lo = min(min(c.r, c.g), c.b);
  float sat = (hi - lo) / max(hi, 1e-4);
  // Cyan / violet light strips: saturated, blue at least as strong as red
  float accent = smoothstep(0.45, 0.7, sat) * step(c.r, c.b) * smoothstep(0.25, 0.6, hi);
  // Windows: near-white, warm, a little saturated (paint is neither)
  float warm = smoothstep(0.9, 1.0, hi) * step(c.b + 0.08, c.r)
    * smoothstep(0.06, 0.25, sat) * (1.0 - smoothstep(0.55, 0.8, sat));
  #ifdef USE_MAP
    vec2 cell = floor(vMapUv * 36.0);
  #else
    vec2 cell = vec2(0.0);
  #endif
  float threshold = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
  float lit = step(threshold, hullWindows * 1.001);
  totalEmissiveRadiance += c * (accent * hullAccentGlow * hullCharge + warm * hullWindowGlow * lit);
}
`;

const glowLevels: Record<WorldTheme, [number, number]> = {
  dark: [2.4, 3.2],
  light: [0.5, 0.7],
};

/** Shared by every hull, so a theme change is one write */
const glow = {
  hullAccentGlow: { value: glowLevels.dark[0] },
  hullWindowGlow: { value: glowLevels.dark[1] },
};

function patch(material: MeshStandardMaterial, station: StationKey) {
  if (material.userData.hull) return;
  material.userData.hull = true;
  const power = stationPower[station];
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, glow, { hullCharge: power.charge, hullWindows: power.windows });
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform float hullAccentGlow;\nuniform float hullWindowGlow;\nuniform float hullCharge;\nuniform float hullWindows;\nvoid main() {'
      )
      .replace('#include <emissivemap_fragment>', glowChunk);
  };
  // Every hull shares one program (each with its own station's power)
  material.customProgramCacheKey = () => 'station-hull';
}

/** Glowing windows and strips following the station's power, and shadows */
function prepareHull(model: Object3D, station: StationKey) {
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial) patch(material, station);
    }
  });
}

const preparers = new Map<StationKey, (model: Object3D) => void>();

/** A station's hull preparer: stable per station, as Model asks */
export function hullPreparer(station: StationKey) {
  let prepare = preparers.get(station);
  if (!prepare) {
    prepare = (model) => prepareHull(model, station);
    preparers.set(station, prepare);
  }
  return prepare;
}

/** Dimmer glow on the light theme, where bloom barely runs */
export function setHullTheme(theme: WorldTheme) {
  [glow.hullAccentGlow.value, glow.hullWindowGlow.value] = glowLevels[theme];
}
