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

import type { Group, Material, Mesh, Object3D, PerspectiveCamera } from 'three';
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
  width: number;
  height: number;
}

interface PanelLayout {
  panel: HTMLElement | null;
  leader: Element | null;
  marker: Element | null;
  width: number;
  height: number;
  left: number;
  top: number;
  dirty: boolean;
}

const up = new Vector3(0, 1, 0);
const normal = new Vector3();
const right = new Vector3();
const look = new Vector3();
const point = new Vector3();
const view = new Vector3();
const forward = new Vector3();
const objectRotation = new Quaternion();
const mountEnd = new Vector3();
const mountDirection = new Vector3();

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
    const index = Math.max(
      0,
      catalog.projects.findIndex((project) => project.id === selection.id)
    );
    const angle = index * helix.turn;
    out.add(
      point.set(Math.sin(angle) * helix.radius, helixScreenY(index), Math.cos(angle) * helix.radius)
    );
  } else if (selection.kind === 'role') {
    const index = Math.max(
      0,
      catalog.roles.findIndex((role) => role.id === selection.id)
    );
    out.y -= ((index + 0.6) / Math.max(1, catalog.roles.length)) * experienceDepth;
  }
  return out;
}

function inspectionPose(
  selection: InspectionSelection,
  anchor: Vector3,
  width: number,
  height: number,
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
  } else if (selection.kind === 'skill') {
    // A keyboard-selected badge can be on the far side of the planet.
    // Approach from its outward side so the planet never hides the artifact.
    normal.copy(anchor).sub(point.fromArray(stationPositions.skills));
    normal.y = MathUtils.clamp(normal.y, -0.15, 0.15);
    if (normal.lengthSq() < 0.01) normal.set(0, 0, 1);
    normal.normalize();
  }
  right.crossVectors(up, normal).normalize();
  const narrow = width < 900;
  const panelWidth = Math.min(440, width - 32);
  const availableWidth = narrow ? width - 40 : width - panelWidth - 72;
  const availableHeight = narrow ? height * 0.27 : height - 160;
  const artifactWidth = selection.kind === 'skill' ? 4.4 : selection.kind === 'role' ? 4.6 : 3.4;
  const artifactHeight =
    selection.kind === 'project' ? 2.1 : selection.kind === 'station' ? 2.5 : 1.8;
  const tangent = Math.tan((baseFov * Math.PI) / 360);
  const distance = Math.max(
    selection.kind === 'project' ? 9 : selection.kind === 'station' ? 16 : 11,
    (artifactWidth * height) / (2 * tangent * Math.max(160, availableWidth)),
    (artifactHeight * height) / (2 * tangent * Math.max(120, availableHeight))
  );
  const unitsPerPixel = (2 * distance * tangent) / height;
  // Reserve a real reading column; centre the artifact in the remaining space.
  const artifactOffset = selection.kind === 'skill' ? -1.4 : selection.kind === 'role' ? 0.7 : 0;
  const offset = narrow ? 0 : (panelWidth + 40) * 0.5 * unitsPerPixel + artifactOffset;
  look.copy(anchor).addScaledVector(right, offset);
  // On a phone the artifact occupies the space above the readable sheet.
  if (narrow) look.y -= distance * tangent * 0.64;
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

function occludesReticle(object: Object3D) {
  if (!(object as Mesh).isMesh) return false;
  const material = (object as Mesh).material;
  const materials: Material[] = Array.isArray(material) ? material : [material];
  return materials.some(
    (item) => item.visible && item.depthWrite && (!item.transparent || item.opacity >= 0.95)
  );
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
  const mount = useRef<Mesh>(null);
  const layout = useRef<PanelLayout>({
    panel: null,
    leader: null,
    marker: null,
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    dirty: true,
  });
  const state = useRef<ViewState>({
    selected: null,
    saved: null,
    from: null,
    to: null,
    elapsed: 0,
    closing: false,
    anchor: new Vector3(),
    located: false,
    width: 0,
    height: 0,
  });
  const { camera, scene, invalidate } = useThree();

  useEffect(() => {
    const panel = document.querySelector<HTMLElement>('[data-inspection-panel]');
    if (!selected || !panel) return;
    const current = layout.current;
    current.panel = panel;
    current.leader = document.querySelector('[data-inspection-leader]');
    current.marker = document.querySelector('[data-inspection-anchor]');
    const measure = () => {
      current.dirty = true;
      invalidate();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      current.panel = null;
    };
  }, [selected, invalidate]);

  useEffect(() => {
    const raycaster = new Raycaster();
    const centre = new Vector2();
    const currentRig = state.current;
    const inspectReticle = () => {
      if (worldMode.get().mode !== 'explore' || hasWorldInputOwner()) return;
      camera.updateMatrixWorld();
      raycaster.setFromCamera(centre, camera);
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        if (!visibleObject(hit.object)) continue;
        const target = selectionMetadata(hit.object);
        if (!target) {
          if (occludesReticle(hit.object)) break;
          continue;
        }
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
      const saved = currentRig.saved;
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
    const resized = rig.width !== size.width || rig.height !== size.height;
    rig.width = size.width;
    rig.height = size.height;
    if (selection !== rig.selected || (selection && resized)) {
      rig.from = snapshot(cam);
      rig.elapsed = 0;
      rig.selected = selection;
      rig.closing = !selection;
      if (selection) {
        rig.saved ??= snapshot(cam);
        setInspectionCameraHeld(true);
        resolveAnchor(selection, catalog, rig.anchor);
        const object = findInspectionObject(scene, selection);
        if (object) object.getWorldPosition(rig.anchor);
        const expectsObject =
          selection.kind !== 'station' || ['home', 'about', 'contact'].includes(selection.station);
        rig.located = !expectsObject || !!selection.anchor || !!object;
        rig.to = inspectionPose(selection, rig.anchor, size.width, size.height, object);
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
        rig.to = inspectionPose(selection, rig.anchor, size.width, size.height, object);
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
      point.copy(rig.anchor).project(cam);
      const anchorX = (point.x * 0.5 + 0.5) * size.width;
      const anchorY = (-point.y * 0.5 + 0.5) * size.height;
      const current = layout.current;
      const panel = current.panel;
      if (panel) {
        // Read layout only after a resize or content change, never in the steady
        // animation loop. The DOM and geometry share the same measured bounds.
        if (current.dirty) {
          const bounds = panel.getBoundingClientRect();
          current.width = bounds.width;
          current.height = bounds.height;
          current.left = bounds.left;
          current.top = bounds.top;
          current.dirty = false;
        }
        if (size.width >= 900) {
          const panelX = Math.max(16, size.width - current.width - 20);
          const panelY = MathUtils.clamp(
            anchorY - current.height * 0.45,
            80,
            Math.max(80, size.height - current.height - 20)
          );
          if (panelX !== current.left || panelY !== current.top) {
            panel.style.setProperty('--inspection-x', `${panelX}px`);
            panel.style.setProperty('--inspection-y', `${panelY}px`);
            current.left = panelX;
            current.top = panelY;
          }
        }
        const { left, top, width, height } = current;
        const attachY = Math.max(top + 24, Math.min(anchorY, top + height - 24));
        current.leader?.setAttribute('x1', `${anchorX}`);
        current.leader?.setAttribute('y1', `${anchorY}`);
        current.leader?.setAttribute('x2', `${left}`);
        current.leader?.setAttribute('y2', `${attachY}`);
        current.marker?.setAttribute('cx', `${anchorX}`);
        current.marker?.setAttribute('cy', `${anchorY}`);

        view.copy(rig.anchor).applyMatrix4(cam.matrixWorldInverse);
        const depth = Math.max(1, -view.z);
        const worldHeight = 2 * depth * Math.tan((cam.fov * Math.PI) / 360);
        const worldWidth = worldHeight * cam.aspect;
        if (frame.current) {
          frame.current.visible = view.z < 0;
          frame.current.position
            .set(
              ((left + width / 2) / size.width - 0.5) * worldWidth,
              (0.5 - (top + height / 2) / size.height) * worldHeight,
              -depth
            )
            .applyMatrix4(cam.matrixWorld);
          frame.current.quaternion.copy(cam.quaternion);
          frame.current.scale.set(
            ((width + 16) / size.width) * worldWidth,
            ((height + 16) / size.height) * worldHeight,
            1
          );
        }
        if (mount.current) {
          mount.current.visible = size.width >= 900 && view.z < 0;
          mountEnd
            .set(
              (left / size.width - 0.5) * worldWidth,
              (0.5 - attachY / size.height) * worldHeight,
              -depth
            )
            .applyMatrix4(cam.matrixWorld);
          mountDirection.subVectors(mountEnd, rig.anchor);
          mount.current.position.copy(rig.anchor).add(mountEnd).multiplyScalar(0.5);
          const length = mountDirection.length();
          mount.current.visible = mount.current.visible && length > 0.01;
          mount.current.scale.y = length;
          if (length > 0.01)
            mount.current.quaternion.setFromUnitVectors(up, mountDirection.normalize());
        }
      } else {
        if (frame.current) frame.current.visible = false;
        if (mount.current) mount.current.visible = false;
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
    <>
      <group ref={frame} visible={false}>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.5, 0, 0]}>
              <boxGeometry args={[0.012, 1.03, 0.08]} />
              <meshStandardMaterial color={color} metalness={0.65} roughness={0.35} />
            </mesh>
            <mesh position={[0, side * 0.5, 0]}>
              <boxGeometry args={[1.02, 0.012, 0.08]} />
              <meshStandardMaterial color={color} metalness={0.65} roughness={0.35} />
            </mesh>
            <mesh position={[side * 0.42, -0.525, -0.02]}>
              <boxGeometry args={[0.035, 0.05, 0.16]} />
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.4} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh ref={mount} visible={false}>
        <cylinderGeometry args={[0.025, 0.025, 1, 8]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.4} />
      </mesh>
    </>
  );
}
