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

/** The giant planet hanging below the stations, and its moon (world space, never fogged) */
export const planet = { position: new Vector3(560, -470, -1050), radius: 150 };
export const moon = { position: new Vector3(820, -90, -1250), radius: 30 };
