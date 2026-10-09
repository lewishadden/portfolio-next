'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Matrix4, Vector3 } from 'three';

import { refreshPointer } from './interaction';
import { tipTarget } from './tipTarget';
import { worldMode } from './worldMode';
import { worldStore, worldTip } from './worldStore';

import type { RootState } from '@react-three/fiber';
import type { Camera, InstancedMesh, Mesh, Object3D } from 'three';

/* ------------------------------------------------------------------
   Pins the tooltip to what it names. While a 3D object's tip is up, its
   box (taken once per object, in the object's own space) is projected
   onto the screen every frame into worldStore.tipBox, so WorldTooltip
   can bracket the object itself rather than trail the pointer, and keep
   up as it turns, bobs or the camera moves. The object is the one named
   with setTipTarget, else the nearest one R3F has under the pointer.

   It also keeps the hover honest while the page scrolls: the camera
   follows the scroll, so the world moves under a pointer that hasn't,
   and R3F only looks again when the pointer moves. For a moment after
   each scroll the last pointer event is replayed once a frame.
   ------------------------------------------------------------------ */

/** How long after the last scroll event the hover is looked at again each frame (ms) */
const scrollSettle = 900;

interface Probe {
  object: Object3D | null;
  instance: number;
  /** The object's box in its own space (an instance's, in the mesh's space) */
  box: Box3;
  scrolledAt: number;
}

interface Target {
  object: Object3D;
  instance: number;
}

const part = new Box3();
const toLocal = new Matrix4();
const relative = new Matrix4();
const instanceMatrix = new Matrix4();
const toView = new Matrix4();
const corner = new Vector3();

/** The tip's object: the one named for it, else the nearest R3F has under the pointer */
function resolve(state: RootState): Target | null {
  const named = tipTarget();
  if (named?.object) return { object: named.object, instance: named.instance };
  let best: Target | null = null;
  let nearest = Infinity;
  for (const hit of state.internal.hovered.values()) {
    if (hit.distance >= nearest) continue;
    nearest = hit.distance;
    const instanced = hit.instanceId !== undefined && hit.eventObject === hit.object;
    best = { object: hit.eventObject, instance: instanced ? (hit.instanceId ?? -1) : -1 };
  }
  return best;
}

/** Bounds of what is drawn under `object`, in its own space (one instance's, for an instance) */
function measure(object: Object3D, instance: number, out: Box3) {
  out.makeEmpty();
  object.updateWorldMatrix(true, true);
  const mesh = object as InstancedMesh;
  if (instance >= 0 && mesh.isInstancedMesh) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (!mesh.geometry.boundingBox) return out;
    mesh.getMatrixAt(instance, instanceMatrix);
    return out.copy(mesh.geometry.boundingBox).applyMatrix4(instanceMatrix);
  }
  toLocal.copy(object.matrixWorld).invert();
  object.traverse((child) => {
    const geometry = (child as Mesh).geometry;
    // A whole instanced mesh (a field of instances) says nothing about one of them
    if (!geometry || (child as InstancedMesh).isInstancedMesh) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) return;
    relative.multiplyMatrices(toLocal, child.matrixWorld);
    out.union(part.copy(geometry.boundingBox).applyMatrix4(relative));
  });
  return out;
}

/**
 * Projects the box's 8 corners into worldStore.tipBox (CSS px). False when
 * it is all behind the camera
 */
function project(object: Object3D, box: Box3, camera: Camera, width: number, height: number) {
  toView.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let behind = 0;
  for (let i = 0; i < 8; i++) {
    corner
      .set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z
      )
      .applyMatrix4(toView);
    // A corner behind the camera is held just in front of it, so it
    // projects far off screen on the side it lies
    if (corner.z > -0.05) {
      behind++;
      corner.z = -0.05;
    }
    corner.applyMatrix4(camera.projectionMatrix);
    const x = ((corner.x + 1) / 2) * width;
    const y = ((1 - corner.y) / 2) * height;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  if (behind === 8) return false;
  const tip = worldStore.tipBox;
  tip.x0 = Math.max(x0, -width);
  tip.y0 = Math.max(y0, -height);
  tip.x1 = Math.min(x1, width * 2);
  tip.y1 = Math.min(y1, height * 2);
  return true;
}

function step(state: RootState, probe: Probe) {
  // The page scrolled a moment ago: look again at what is under the pointer
  if (
    performance.now() - probe.scrolledAt < scrollSettle &&
    worldMode.get().mode === 'page' &&
    !document.pointerLockElement
  ) {
    refreshPointer(state);
  }

  const tip = worldStore.tipBox;
  const target = worldTip.get() ? resolve(state) : null;
  if (!target) {
    tip.on = false;
    probe.object = null;
    return;
  }
  if (target.object !== probe.object || target.instance !== probe.instance || probe.box.isEmpty()) {
    probe.object = target.object;
    probe.instance = target.instance;
    // A model still streaming in has nothing to measure yet: tried again next frame
    measure(target.object, target.instance, probe.box);
  }
  if (probe.box.isEmpty()) {
    tip.on = false;
    return;
  }
  // The rig has moved the camera this frame; the renderer only updates its
  // matrices as it draws
  state.camera.updateMatrixWorld();
  tip.on = project(target.object, probe.box, state.camera, state.size.width, state.size.height);
}

/** Keeps worldStore.tipBox on the hovered object (see above). Mount after CameraRig */
export function TipProbe() {
  const probe = useRef<Probe>({ object: null, instance: -1, box: new Box3(), scrolledAt: 0 });

  useEffect(() => {
    const current = probe.current;
    const onScroll = () => {
      current.scrolledAt = performance.now();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      worldStore.tipBox.on = false;
    };
  }, []);

  useFrame((state) => step(state, probe.current));
  return null;
}
