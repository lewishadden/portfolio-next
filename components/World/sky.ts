import { Vector3 } from 'three';

/**
 * Fixed features of the sky, shared by everything lit by or drawn in it:
 * the sun (key light, shadows, sky glow, flare, the planet's terminator),
 * the Milky Way's plane, and the landmark planet and moon.
 */

/** Towards the sun: from the left, a little above, slightly behind the stations' cameras */
export const sunDirection = new Vector3(-0.82, 0.34, 0.22).normalize();

/** Normal of the Milky Way's plane (the band is where the sky is perpendicular to it) */
export const galacticNormal = new Vector3(0.32, 0.78, -0.54).normalize();
/** Towards the galactic centre (the bulge), in the plane: off to the left of the stations */
export const galacticCentre = new Vector3(-1, 0, -0.6)
  .addScaledVector(galacticNormal, -new Vector3(-1, 0, -0.6).dot(galacticNormal))
  .normalize();
/** The third axis of the galactic frame */
export const galacticEast = new Vector3().crossVectors(galacticNormal, galacticCentre).normalize();

/** A direction from galactic longitude (0 towards the centre) and latitude, radians */
const galactic = (lon: number, lat: number) =>
  new Vector3()
    .addScaledVector(galacticCentre, Math.cos(lat) * Math.cos(lon))
    .addScaledVector(galacticEast, Math.cos(lat) * Math.sin(lon))
    .addScaledVector(galacticNormal, Math.sin(lat));

/**
 * The nebula complexes: star-forming regions strung along the plane, as the
 * real ones are. Direction, angular radius (radians) and which gas dominates
 * (0 = hydrogen pink, 1 = oxygen teal; the shader drifts between them).
 */
export const nebulae: { direction: Vector3; radius: number; kind: number }[] = [
  { direction: galactic(0.45, 0.07), radius: 0.46, kind: 0.25 },
  // Above the plane, straight behind the stations: the pages' backdrop
  { direction: galactic(-0.9, 0.42), radius: 0.42, kind: 0.75 },
  { direction: galactic(-1.3, 0.28), radius: 0.22, kind: 0.1 },
  { direction: galactic(2.6, 0.14), radius: 0.3, kind: 0.45 },
  { direction: galactic(-2.3, -0.05), radius: 0.26, kind: 0.1 },
  { direction: galactic(1.4, 0.24), radius: 0.2, kind: 0.65 },
];

/** The giant planet hanging below the stations, and its moon (world space, never fogged) */
export const planet = { position: new Vector3(560, -470, -1050), radius: 150 };
export const moon = { position: new Vector3(820, -90, -1250), radius: 30 };
