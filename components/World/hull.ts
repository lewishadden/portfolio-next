import { Mesh, MeshStandardMaterial } from 'three';

import type { Object3D } from 'three';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Station hulls (image-to-3D, PBR textures). Their window lights and
   accent strips are painted into the colour texture, so they would
   only ever be as bright as white paint. This derives an emissive term
   from the colour itself: very bright warm pixels (windows) and
   saturated blue-side pixels (the cyan / violet strips) glow, enough
   for the bloom pass to pick them up; neutral panels and gold foil don't.
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
  totalEmissiveRadiance += c * (accent * hullAccentGlow + warm * hullWindowGlow);
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

function patch(material: MeshStandardMaterial) {
  if (material.userData.hull) return;
  material.userData.hull = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, glow);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform float hullAccentGlow;\nuniform float hullWindowGlow;\nvoid main() {'
      )
      .replace('#include <emissivemap_fragment>', glowChunk);
  };
  // Every hull shares one program
  material.customProgramCacheKey = () => 'station-hull';
}

/** Glowing windows and strips, and shadows */
export function prepareHull(model: Object3D) {
  model.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial) patch(material);
    }
  });
}

/** Dimmer glow on the light theme, where bloom barely runs */
export function setHullTheme(theme: WorldTheme) {
  [glow.hullAccentGlow.value, glow.hullWindowGlow.value] = glowLevels[theme];
}
