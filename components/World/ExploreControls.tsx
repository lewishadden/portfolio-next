'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Euler, MathUtils, PerspectiveCamera, Vector3 } from 'three';

import { navigableStations } from './routes';
import { baseFov, stationPositions } from './stations';
import { worldMode } from './worldMode';
import { exploreInput, setDock, worldStore } from './worldStore';

/* ------------------------------------------------------------------
   Free flight. While the world is in explore mode the visitor flies the
   camera: keys or the on-screen pad to move, drag to look. Flying close
   to a station offers to dock, which opens its page (the camera rig
   then flies the last stretch in). Hulls push you back out rather than
   letting you clip inside them.
   ------------------------------------------------------------------ */

const keys = new Map<string, keyof typeof exploreInput>([
  ['KeyW', 'forward'],
  ['ArrowUp', 'forward'],
  ['KeyS', 'forward'],
  ['ArrowDown', 'forward'],
  ['KeyA', 'strafe'],
  ['KeyD', 'strafe'],
  ['ArrowLeft', 'turn'],
  ['ArrowRight', 'turn'],
  ['Space', 'lift'],
  ['KeyC', 'lift'],
]);
const negative = new Set(['KeyS', 'ArrowDown', 'KeyA', 'ArrowLeft', 'KeyC']);

const euler = new Euler(0, 0, 0, 'YXZ');
const forward = new Vector3();
const right = new Vector3();
const up = new Vector3(0, 1, 0);
const velocity = new Vector3();
const wish = new Vector3();
const station = new Vector3();
const centre = new Vector3(0, 0, -110);

const dockRange = 18;
const hullRadius = 5.5;
const worldRadius = 520;

function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable]')
  );
}

export function ExploreControls() {
  const look = useRef({ yaw: 0, pitch: 0, active: false });

  // Keyboard: held keys set the axes; Enter docks; Escape leaves
  useEffect(() => {
    const held = new Set<string>();
    const apply = () => {
      exploreInput.forward = 0;
      exploreInput.strafe = 0;
      exploreInput.lift = 0;
      exploreInput.turn = 0;
      for (const code of held) {
        const axis = keys.get(code);
        if (axis && axis !== 'boost' && axis !== 'lookX' && axis !== 'lookY') {
          (exploreInput[axis] as number) += negative.has(code) ? -1 : 1;
        }
      }
    };
    const down = (e: KeyboardEvent) => {
      if (worldMode.get().mode !== 'explore' || typing(e.target)) return;
      if (e.key === 'Escape') {
        worldMode.exit();
        return;
      }
      if (e.key === 'Shift') exploreInput.boost = true;
      if (keys.has(e.code)) {
        e.preventDefault();
        held.add(e.code);
        apply();
      }
    };
    const upKey = (e: KeyboardEvent) => {
      if (e.key === 'Shift') exploreInput.boost = false;
      if (held.delete(e.code)) apply();
    };
    const blur = () => {
      held.clear();
      exploreInput.boost = false;
      apply();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', upKey);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', upKey);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Drag to look (mouse and touch), anywhere that isn't a control
  useEffect(() => {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (e: PointerEvent) => {
      if (worldMode.get().mode !== 'explore') return;
      if (e.target instanceof Element && e.target.closest('button, a, input, .explore-hud__pad'))
        return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      exploreInput.lookX += (e.clientX - lastX) * 0.0042;
      exploreInput.lookY += (e.clientY - lastY) * 0.0036;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const end = () => {
      dragging = false;
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  useFrame(({ camera }, delta) => {
    const state = look.current;
    if (worldMode.get().mode !== 'explore') {
      if (state.active) {
        state.active = false;
        velocity.set(0, 0, 0);
        setDock('');
      }
      return;
    }
    const cam = camera as PerspectiveCamera;
    const dt = Math.min(delta, 1 / 20);

    // Take over from wherever the camera was pointing
    if (!state.active) {
      state.active = true;
      euler.setFromQuaternion(cam.quaternion, 'YXZ');
      state.yaw = euler.y;
      state.pitch = euler.x;
      velocity.set(0, 0, 0);
    }

    state.yaw -= exploreInput.lookX + exploreInput.turn * 1.6 * dt;
    state.pitch = MathUtils.clamp(state.pitch - exploreInput.lookY, -1.35, 1.35);
    exploreInput.lookX = 0;
    exploreInput.lookY = 0;
    euler.set(state.pitch, state.yaw, 0, 'YXZ');
    cam.quaternion.setFromEuler(euler);

    // Thrust along where the camera faces, with drag
    forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
    right.crossVectors(forward, up).normalize();
    const thrust = exploreInput.boost ? 70 : 26;
    wish
      .copy(forward)
      .multiplyScalar(exploreInput.forward)
      .addScaledVector(right, exploreInput.strafe)
      .addScaledVector(up, exploreInput.lift);
    if (wish.lengthSq() > 1) wish.normalize();
    velocity.addScaledVector(wish, thrust * dt * 2.6);
    velocity.multiplyScalar(Math.exp(-2.6 * dt));
    cam.position.addScaledVector(velocity, dt);

    // Hulls push back; the edge of the world gently turns you round
    let nearest = '';
    let nearestDistance = Infinity;
    for (const key of navigableStations) {
      station.fromArray(stationPositions[key]);
      const distance = cam.position.distanceTo(station);
      if (distance < hullRadius) {
        const push = station
          .sub(cam.position)
          .normalize()
          .multiplyScalar(-(hullRadius - distance));
        cam.position.add(push);
      }
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = key;
      }
    }
    const fromCentre = cam.position.distanceTo(centre);
    if (fromCentre > worldRadius) {
      velocity.addScaledVector(
        station.copy(centre).sub(cam.position).normalize(),
        (fromCentre - worldRadius) * dt
      );
    }
    setDock(nearestDistance < dockRange ? nearest : '');

    const speed = velocity.length();
    worldStore.velocity = speed;
    cam.fov = MathUtils.damp(cam.fov, baseFov + Math.min(speed * 0.25, 18), 4, dt);
    cam.updateProjectionMatrix();
  });

  return null;
}
