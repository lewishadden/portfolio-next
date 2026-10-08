'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Quaternion, Raycaster, Vector2, Vector3 } from 'three';

import { lookRotation, smootherstep } from './flight';
import { inspectEntity, inspection, setInspectionCameraHeld, useInspection } from './inspection';
import { hasWorldInputOwner } from './inputOwnership';
import { stationKeys, stationPositions } from './routes';
import { baseFov, experienceDepth, helix, helixScreenY } from './stations';
import { getTravelPreference } from './travelPreference';
import { palettes } from './utils';
import { worldMode } from './worldMode';
import { worldStore, worldTip } from './worldStore';

import type { Group, Object3D, PerspectiveCamera } from 'three';
import type { InspectionCatalog, InspectionSelection } from './inspectionTypes';
import type { StationKey } from './routes';
import type { WorldTheme } from './utils';

interface Pose {
  position: Vector3;
  rotation: Quaternion;
  fov: number;
}

interface ViewState {
  selected: InspectionSelection | null;
  saved: Pose | null;
  from: Pose | null;
  to: Pose | null;
  elapsed: number;
  closing: boolean;
  anchor: Vector3;
  located: boolean;
}

const up = new Vector3(0, 1, 0);
const normal = new Vector3();
const right = new Vector3();
const look = new Vector3();
const point = new Vector3();
const view = new Vector3();
const forward = new Vector3();
const objectRotation = new Quaternion();

const snapshot = (camera: PerspectiveCamera): Pose => ({
  position: camera.position.clone(),
  rotation: camera.quaternion.clone(),
  fov: camera.fov,
});

/** Direct links use the same anchor as the corresponding authored station object. */
function resolveAnchor(selection: InspectionSelection, catalog: InspectionCatalog, out: Vector3) {
  if (selection.anchor) return out.fromArray(selection.anchor);
  out.fromArray(stationPositions[selection.station]);
  if (selection.kind === 'project') {
    const index = Math.max(0, catalog.projects.findIndex((project) => project.id === selection.id));
    const angle = index * helix.turn;
    out.add(
      point.set(Math.sin(angle) * helix.radius, helixScreenY(index), Math.cos(angle) * helix.radius)
    );
  } else if (selection.kind === 'role') {
    const index = Math.max(0, catalog.roles.findIndex((role) => role.id === selection.id));
    out.y -= ((index + 0.6) / Math.max(1, catalog.roles.length)) * experienceDepth;
  }
  return out;
}

function inspectionPose(
  selection: InspectionSelection,
  anchor: Vector3,
  camera: PerspectiveCamera,
  width: number,
  object: Object3D | null
): Pose {
  normal.set(0, 0, 1);
  if (selection.kind === 'project') {
    if (object) normal.applyQuaternion(object.getWorldQuaternion(objectRotation));
    else {
      normal.copy(anchor).sub(point.fromArray(stationPositions.projects));
      normal.y = 0;
      normal.normalize();
    }
  } else if (selection.kind === 'skill' && selection.anchor) {
    normal.subVectors(camera.position, anchor).normalize();
    normal.y = MathUtils.clamp(normal.y, -0.15, 0.15);
    normal.normalize();
  }
  right.crossVectors(up, normal).normalize();
  const narrow = width < 900;
  const distance = selection.kind === 'project' ? 9 : selection.kind === 'station' ? 16 : 11;
  look.copy(anchor).addScaledVector(right, narrow ? 0 : 2.4);
  // On a phone the artifact occupies the space above the readable sheet.
  if (narrow) look.y -= distance * 0.18;
  const position = look.clone().addScaledVector(normal, distance);
  return { position, rotation: lookRotation(position, look, new Quaternion()), fov: baseFov };
}

function findInspectionObject(scene: Object3D, selection: InspectionSelection): Object3D | null {
  let found: Object3D | null = null;
  scene.traverse((object) => {
    const value = object.userData.inspection as InspectionSelection | undefined;
    if (!found && value?.kind === selection.kind && value.id === selection.id) found = object;
  });
  return found;
}

function selectionMetadata(object: Object3D): InspectionSelection | null {
  let current: Object3D | null = object;
  while (current) {
    const value: unknown = current.userData.inspection;
    if (value && typeof value === 'object') {
      const candidate = value as Partial<InspectionSelection>;
      if (
        ['project', 'role', 'skill', 'station'].includes(candidate.kind ?? '') &&
        typeof candidate.id === 'string' &&
        stationKeys.includes(candidate.station as StationKey)
      )
        return candidate as InspectionSelection;
    }
    current = current.parent;
  }
  return null;
}

function visibleObject(object: Object3D) {
  let current: Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

/** One scene-owned frame; DOM copy remains selectable, readable and keyboard accessible. */
export function InspectionRig({
  catalog,
  theme,
  reducedMotion,
}: {
  catalog: InspectionCatalog;
  theme: WorldTheme;
  reducedMotion: boolean;
}) {
  const selected = useInspection();
  const frame = useRef<Group>(null);
  const state = useRef<ViewState>({
    selected: null,
    saved: null,
    from: null,
    to: null,
    elapsed: 0,
    closing: false,
    anchor: new Vector3(),
    located: false,
  });
  const { camera, scene, invalidate } = useThree();

  useEffect(() => {
    const panel = document.querySelector('[data-inspection-panel]');
    if (!selected || !panel) return;
    const observer = new ResizeObserver(() => invalidate());
    observer.observe(panel);
    return () => observer.disconnect();
  }, [selected, invalidate]);

  useEffect(() => {
    const raycaster = new Raycaster();
    const centre = new Vector2();
    const inspectReticle = () => {
      if (worldMode.get().mode !== 'explore' || hasWorldInputOwner()) return;
      camera.updateMatrixWorld();
      raycaster.setFromCamera(centre, camera);
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        if (!visibleObject(hit.object)) continue;
        const target = selectionMetadata(hit.object);
        if (!target) continue;
        inspectEntity({ ...target, anchor: hit.point.toArray() });
        invalidate();
        break;
      }
    };
    window.addEventListener('world:inspect-reticle', inspectReticle);
    const unsubscribe = inspection.subscribe(invalidate);
    return () => {
      window.removeEventListener('world:inspect-reticle', inspectReticle);
      unsubscribe();
      const saved = state.current.saved;
      if (saved) {
        camera.position.copy(saved.position);
        camera.quaternion.copy(saved.rotation);
        (camera as PerspectiveCamera).fov = saved.fov;
        camera.updateProjectionMatrix();
      }
      setInspectionCameraHeld(false);
    };
  }, [camera, scene, invalidate]);

  useFrame(({ camera, size }, delta) => {
    const cam = camera as PerspectiveCamera;
    const rig = state.current;
    const selection = inspection.get();
    const calm = reducedMotion || getTravelPreference() === 'calm';
    if (selection !== rig.selected) {
      rig.from = snapshot(cam);
      rig.elapsed = 0;
      rig.selected = selection;
      rig.closing = !selection;
      if (selection) {
        rig.saved ??= snapshot(cam);
        setInspectionCameraHeld(true);
        resolveAnchor(selection, catalog, rig.anchor);
        const object = findInspectionObject(scene, selection);
        if (!selection.anchor && object) object.getWorldPosition(rig.anchor);
        rig.located = selection.kind === 'station' || !!selection.anchor || !!object;
        rig.to = inspectionPose(selection, rig.anchor, cam, size.width, object);
      } else rig.to = rig.saved;
    }

    // A direct link can select an unvisited station. Its meshes mount after
    // the selection; resolve their authored transforms as soon as they exist.
    if (selection && !rig.located) {
      const object = findInspectionObject(scene, selection);
      if (object) {
        rig.located = true;
        object.getWorldPosition(rig.anchor);
        rig.from = snapshot(cam);
        rig.to = inspectionPose(selection, rig.anchor, cam, size.width, object);
        rig.elapsed = 0;
      }
    }

    if (rig.to && rig.from) {
      rig.elapsed += Math.min(delta, 1 / 20);
      const progress = calm ? 1 : Math.min(1, rig.elapsed / (rig.closing ? 0.4 : 0.65));
      const amount = smootherstep(progress);
      if (progress === 1) {
        cam.position.copy(rig.to.position);
        cam.quaternion.copy(rig.to.rotation);
        cam.fov = rig.to.fov;
      } else {
        cam.position.lerpVectors(rig.from.position, rig.to.position, amount);
        cam.quaternion.copy(rig.from.rotation).slerp(rig.to.rotation, amount);
        cam.fov = MathUtils.lerp(rig.from.fov, rig.to.fov, amount);
      }
      cam.updateProjectionMatrix();
      worldStore.velocity = 0;
      if (progress < 1) invalidate();
      else if (rig.closing) {
        // Other camera rigs have already skipped this frame. Publish the exact
        // saved pose for one complete frame before handing their controls back.
        rig.saved = null;
        rig.from = null;
        rig.to = null;
        rig.closing = false;
        setInspectionCameraHeld(false);
        invalidate();
      }
    }

    cam.updateMatrixWorld();
    if (selection) {
      forward.set(0, 0, -1).applyQuaternion(cam.quaternion);
      Object.assign(worldStore.camera, {
        x: cam.position.x,
        y: cam.position.y,
        z: cam.position.z,
        fx: forward.x,
        fy: forward.y,
        fz: forward.z,
        heading: Math.atan2(forward.x, -forward.z),
      });
      if (frame.current) {
        frame.current.position.copy(rig.anchor);
        frame.current.quaternion.copy(cam.quaternion);
      }
      point.copy(rig.anchor).project(cam);
      const anchorX = (point.x * 0.5 + 0.5) * size.width;
      const anchorY = (-point.y * 0.5 + 0.5) * size.height;
      const panel = document.querySelector<HTMLElement>('[data-inspection-panel]');
      if (panel) {
        const bounds = panel.getBoundingClientRect();
        const panelX = MathUtils.clamp(
          anchorX + 80,
          16,
          Math.max(16, size.width - bounds.width - 20)
        );
        const panelY = MathUtils.clamp(
          anchorY - bounds.height * 0.45,
          80,
          Math.max(80, size.height - bounds.height - 20)
        );
        panel.style.setProperty('--inspection-x', `${panelX}px`);
        panel.style.setProperty('--inspection-y', `${panelY}px`);
        const leader = document.querySelector('[data-inspection-leader]');
        leader?.setAttribute('x1', `${anchorX}`);
        leader?.setAttribute('y1', `${anchorY}`);
        leader?.setAttribute('x2', `${panelX}`);
        leader?.setAttribute(
          'y2',
          `${Math.max(panelY + 24, Math.min(anchorY, panelY + bounds.height - 24))}`
        );
        const marker = document.querySelector('[data-inspection-anchor]');
        marker?.setAttribute('cx', `${anchorX}`);
        marker?.setAttribute('cy', `${anchorY}`);
      }
    }

    const tip = worldTip.get();
    if (tip?.anchor && !selection) {
      point.fromArray(tip.anchor);
      view.copy(point).applyMatrix4(cam.matrixWorldInverse);
      point.project(cam);
      window.dispatchEvent(
        new CustomEvent('world:tip-position', {
          detail: {
            x: (point.x * 0.5 + 0.5) * size.width,
            y: (-point.y * 0.5 + 0.5) * size.height,
            visible: view.z < 0 && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1,
          },
        })
      );
    }
  });

  if (!selected) return null;
  const color = palettes[theme].cyan;
  return (
    <group ref={frame}>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 2, 0, 0.06]}>
            <boxGeometry args={[0.035, 2.6, 0.045]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} />
          </mesh>
          <mesh position={[0, side * 1.3, 0.06]}>
            <boxGeometry args={[4, 0.035, 0.045]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} />
          </mesh>
          <mesh position={[side * 2, -1.45, 0]}>
            <boxGeometry args={[0.12, 0.3, 0.12]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
