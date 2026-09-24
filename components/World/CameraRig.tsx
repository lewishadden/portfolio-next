'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { PerspectiveCamera, Vector3 } from 'three';

import { isWideViewport, stationCamera, stationPositions } from './stations';
import { worldStore } from './worldStore';

import type { StationKey } from './stations';

const target = new Vector3();
const look = new Vector3();
const origin = new Vector3();
const lookCurrent = new Vector3();
const previous = new Vector3();
const introOffset = new Vector3(-14, 10, 58);

/**
 * Flies the camera to the active station and follows page scroll inside it.
 * Camera speed feeds worldStore.velocity, which the starfield, FOV and
 * chromatic aberration use for the warp effect.
 */
export function CameraRig({
  station,
  reducedMotion,
}: {
  station: StationKey;
  reducedMotion: boolean;
}) {
  const state = useRef({ progress: 0, screens: 0, started: false });

  useFrame(({ camera, clock, size }, delta) => {
    const cam = camera as PerspectiveCamera;
    const dt = Math.min(delta, 1 / 20);
    const rig = state.current;
    const wide = isWideViewport(size.width, size.height);

    if (reducedMotion) {
      rig.progress = worldStore.scroll;
      rig.screens = worldStore.screens;
    } else {
      easing.damp(rig, 'progress', worldStore.scroll, 0.14, dt);
      easing.damp(rig, 'screens', worldStore.screens, 0.14, dt);
    }

    stationCamera(station, rig.progress, rig.screens, wide, target, look);
    origin.fromArray(stationPositions[station]);
    target.add(origin);
    look.add(origin);

    if (!reducedMotion) {
      target.x += worldStore.pointerX * 0.45;
      target.y += worldStore.pointerY * 0.28;
    }

    // First frame: start out in deep space and warp in
    if (!rig.started) {
      rig.started = true;
      if (reducedMotion) cam.position.copy(target);
      else cam.position.copy(target).add(introOffset);
      lookCurrent.copy(look);
    }

    previous.copy(cam.position);
    if (reducedMotion) {
      cam.position.copy(target);
      lookCurrent.copy(look);
    } else {
      const travelling = cam.position.distanceToSquared(target) > 9;
      easing.damp3(cam.position, target, travelling ? 0.75 : 0.2, dt);
      easing.damp3(lookCurrent, look, travelling ? 0.6 : 0.16, dt);
    }
    cam.lookAt(lookCurrent);

    // Snapped (reduced-motion) cameras jump between poses — that is not flight
    const speed = reducedMotion ? 0 : cam.position.distanceTo(previous) / Math.max(dt, 1e-4);
    worldStore.velocity = speed;

    const fov = 42 + (reducedMotion ? 0 : Math.min(speed * 0.3, 24));
    easing.damp(cam, 'fov', fov, 0.3, dt);
    cam.updateProjectionMatrix();

    if (worldStore.launchRequested) {
      worldStore.launchRequested = false;
      worldStore.launchAt = clock.elapsedTime;
    }
  });

  return null;
}
