import { Euler, Quaternion } from 'three';

import { worldStore } from './worldStore';

import type { Camera } from 'three';

const jolt = new Quaternion();
const angles = new Euler();

/**
 * Jolts the view while worldStore.shake is up (the rocket's launch, a bump
 * against a hull in free roam): a small, fast wobble of the rotation only,
 * so the camera's measured speed (and the warp effects that follow it)
 * never sees it. It decays by itself; reduced motion only lets it decay.
 * Call after the camera's rotation is set for the frame.
 */
export function applyShake(camera: Camera, t: number, dt: number, still: boolean) {
  const amount = worldStore.shake;
  if (amount < 1e-3) {
    worldStore.shake = 0;
    return;
  }
  worldStore.shake = amount * Math.exp(-2.5 * dt);
  if (still) return;
  const k = 0.012 * amount;
  angles.set(
    k * (Math.sin(t * 37.1) + 0.6 * Math.sin(t * 61.7)),
    k * (Math.sin(t * 29.3 + 1.7) + 0.6 * Math.sin(t * 53.9)),
    k * 0.8 * Math.sin(t * 43.3 + 0.4)
  );
  camera.quaternion.multiply(jolt.setFromEuler(angles));
}
