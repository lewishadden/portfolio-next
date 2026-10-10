import { Vector3 } from 'three';

import { navigableStations, stationPositions } from './routes';
import { cometAt, signals } from './signalStore';
import { helix, helixScreenY } from './stations';

/* ------------------------------------------------------------------
   What free roam's ship can't fly through. Each collider is a simple
   solid standing in for a craft (a sphere round a hull, a capsule along
   the experience beam and its pods, a cylinder round the projects helix,
   spheres for the derelict and each signal craft); the ship keeps
   `shipMargin` clear of it, so it bounces off the proxy a little before
   its own nose would meet the real thing, and the contact point (where a
   ping and sparks fly) lies on the solid's surface, in front of the
   camera rather than at it. Canvas side: three.js maths only.
   ------------------------------------------------------------------ */

/** How far from a solid the ship is held (world units) */
export const shipMargin = 1.6;

/** Where the ship meets a collider: the way out, how far it is from the surface (negative inside) and the point on it */
export interface Contact {
  normal: Vector3;
  gap: number;
  point: Vector3;
}

type Shape =
  | { kind: 'sphere'; centre: Vector3; surface: number; comet?: boolean }
  | { kind: 'capsule'; a: Vector3; b: Vector3; surface: number }
  | { kind: 'cylinder'; x: number; z: number; y0: number; y1: number; surface: number };

const at = (key: keyof typeof stationPositions, x = 0, y = 0, z = 0) =>
  new Vector3(...stationPositions[key]).add(new Vector3(x, y, z));

/** The experience beam runs from just over the hull down past its last pod (ExperienceStation) */
const beamTop = 4;
const beamBottom = -40;
/** Signal craft sizes, as Signals.tsx builds them (the derelict and the comet are their own) */
const craftSize: Partial<Record<(typeof signals)[number]['id'], number>> = {
  probe: 2.2,
  capsule: 1.5,
  relay: 3,
};

const shapes: Shape[] = [
  // Every station's hull, held 5.5 from its centre, as free roam always has
  ...navigableStations.map(
    (key): Shape => ({ kind: 'sphere', centre: at(key), surface: 5.5 - shipMargin })
  ),
  // The experience beam and the pods strung along it
  {
    kind: 'capsule',
    a: at('experience', 0, beamTop),
    b: at('experience', 0, beamBottom),
    surface: 0.75,
  },
  // The projects helix: its screens turn about the spine, so a cylinder fits whatever the turn
  {
    kind: 'cylinder',
    x: stationPositions.projects[0],
    z: stationPositions.projects[2],
    y0: stationPositions.projects[1] + helixScreenY(helix.screens - 1) - 0.7,
    y1: stationPositions.projects[1] + helix.top + 0.7,
    surface: helix.radius + 1.15,
  },
  // The derelict: the lost astronaut and the wreck behind it (LostStation)
  { kind: 'sphere', centre: at('lost', -1.6, 0.6, -3), surface: 4.5 },
  // The signal craft drifting off the line of stations
  ...signals.flatMap((signal): Shape[] => {
    const size = craftSize[signal.id];
    return size ? [{ kind: 'sphere', centre: new Vector3(...signal.position), surface: size }] : [];
  }),
  // The comet's nucleus, on its orbit
  { kind: 'sphere', centre: new Vector3(), surface: 1.2, comet: true },
];

export const colliderCount = shapes.length;

const toPoint = new Vector3();
const segment = new Vector3();

/** Fills `out` for the ship at `position` against one solid (`t`: clock time, for the comet) */
function measure(shape: Shape, position: Vector3, t: number, out: Contact) {
  const { normal } = out;
  switch (shape.kind) {
    case 'sphere': {
      if (shape.comet) cometAt(t, shape.centre);
      normal.subVectors(position, shape.centre);
      const distance = normal.length();
      if (distance < 1e-4) normal.set(0, 1, 0);
      else normal.divideScalar(distance);
      out.gap = distance - shape.surface;
      out.point.copy(shape.centre).addScaledVector(normal, shape.surface);
      return;
    }
    case 'capsule': {
      segment.subVectors(shape.b, shape.a);
      const along = Math.min(
        1,
        Math.max(0, toPoint.subVectors(position, shape.a).dot(segment) / segment.lengthSq())
      );
      const axis = toPoint.copy(shape.a).addScaledVector(segment, along);
      normal.subVectors(position, axis);
      const distance = normal.length();
      if (distance < 1e-4) normal.set(1, 0, 0);
      else normal.divideScalar(distance);
      out.gap = distance - shape.surface;
      out.point.copy(axis).addScaledVector(normal, shape.surface);
      return;
    }
    case 'cylinder': {
      const dx = position.x - shape.x;
      const dz = position.z - shape.z;
      const radial = Math.hypot(dx, dz);
      const ux = radial > 1e-4 ? dx / radial : 1;
      const uz = radial > 1e-4 ? dz / radial : 0;
      const end = position.y > shape.y1 ? shape.y1 : position.y < shape.y0 ? shape.y0 : null;
      if (end === null) {
        // Beside it: straight out from the spine
        normal.set(ux, 0, uz);
        out.gap = radial - shape.surface;
        out.point.set(shape.x + ux * shape.surface, position.y, shape.z + uz * shape.surface);
      } else if (radial <= shape.surface) {
        // Over or under it: straight off its end
        normal.set(0, Math.sign(position.y - end), 0);
        out.gap = Math.abs(position.y - end);
        out.point.set(position.x, end, position.z);
      } else {
        // Off its rim
        out.point.set(shape.x + ux * shape.surface, end, shape.z + uz * shape.surface);
        normal.subVectors(position, out.point);
        out.gap = normal.length();
        normal.divideScalar(Math.max(out.gap, 1e-4));
      }
    }
  }
}

/**
 * The ship at `position` against collider `index`: true when it is within
 * `shipMargin` of it, with `out` saying which way is out and where they meet
 */
export function contactWith(index: number, position: Vector3, t: number, out: Contact) {
  measure(shapes[index], position, t, out);
  return out.gap < shipMargin;
}
