'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

import type { Camera } from 'three';

/**
 * How the camera is moving, measured once a frame after whatever flies it
 * (CameraRig, ExploreControls) has moved it, for the effects that follow
 * motion: star and dust streaks, the streak blur. `focusX` / `focusY` are
 * where on screen (-1..1, y up) the camera is heading; `ahead` is how much
 * of its motion is into the view (1 straight ahead, 0 sideways, negative
 * backwards). Snaps (reduced motion, teleports) never count as motion.
 */
export const cameraMotion = {
  velocity: new Vector3(),
  speed: 0,
  focusX: 0,
  focusY: 0,
  ahead: 0,
};

const raw = new Vector3();
const forward = new Vector3();
const heading = new Vector3();

function measure(
  camera: Camera,
  previous: { position: Vector3; started: boolean },
  dt: number,
  still: boolean
) {
  const motion = cameraMotion;
  raw.subVectors(camera.position, previous.position);
  previous.position.copy(camera.position);
  // The first frame, a snap or a jump of more than a flight's top speed
  // could manage in a frame is a cut, not motion
  const cut = !previous.started || still || raw.length() > 15;
  previous.started = true;
  if (cut || dt <= 0) raw.set(0, 0, 0);
  else raw.divideScalar(dt);
  // Ease towards the measured velocity: frame-time jitter would flicker the streaks
  motion.velocity.lerp(raw, 1 - Math.exp(-14 * dt));
  motion.speed = motion.velocity.length();
  if (motion.speed < 0.5) {
    motion.ahead = 0;
    return;
  }
  forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  heading.copy(motion.velocity).divideScalar(motion.speed);
  motion.ahead = forward.dot(heading);
  heading.multiplyScalar(100).add(camera.position).project(camera);
  motion.focusX = heading.x;
  motion.focusY = heading.y;
}

/** Mount after CameraRig and ExploreControls, so it measures this frame's move */
export function MotionProbe({ reducedMotion }: { reducedMotion: boolean }) {
  const previous = useRef({ position: new Vector3(), started: false });
  useFrame(({ camera }, delta) =>
    measure(camera, previous.current, Math.min(delta, 0.1), reducedMotion)
  );
  return null;
}
