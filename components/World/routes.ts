/**
 * Route → station mapping. Deliberately free of three.js imports: the root
 * layout's World gate uses it, and anything it imports lands in the main bundle.
 */
export const stationKeys = [
  'home',
  'about',
  'experience',
  'projects',
  'skills',
  'contact',
  'lost',
] as const;

export type StationKey = (typeof stationKeys)[number];

/**
 * Where each route lives in space. Stations are spread far enough apart that
 * the camera visibly travels (and passes stars/dust) between them.
 */
export const stationPositions: Record<StationKey, [number, number, number]> = {
  home: [0, 0, 0],
  about: [48, 12, -36],
  experience: [-42, -4, -82],
  projects: [36, -16, -132],
  skills: [-36, 14, -178],
  contact: [8, -6, -226],
  lost: [96, 44, 34],
};

/**
 * Free roam's sector: the middle of the line of stations, and how far from
 * it the ship can fly before it is turned back (the edge of the world)
 */
export const sectorCentre: [number, number, number] = [0, 0, -110];
export const sectorRadius = 520;

/**
 * Free roam's autopilot parks this far in front of a station's face (pages
 * frame it from +Z): ExploreControls flies there, and the signals HUD
 * counts a course as arrived once the ship is parked there
 */
export const parkingOffset: readonly [number, number, number] = [0, 1.5, 16];

/** /contact: the comms array's dish rim, from the station's centre (its transmissions set off there) */
export const contactDish: readonly [number, number, number] = [3.85, 0.65, -2.9];

/** Distance between two stations, centre to centre, in whole world units (the HUD's "km") */
export function rangeBetween(a: StationKey, b: StationKey) {
  const [ax, ay, az] = stationPositions[a];
  const [bx, by, bz] = stationPositions[b];
  return Math.round(Math.hypot(bx - ax, by - ay, bz - az));
}

/** The page each station belongs to ('lost' is the 404 and has no page of its own) */
export const stationPaths: Record<StationKey, string> = {
  home: '/',
  about: '/about',
  experience: '/experience',
  projects: '/projects',
  skills: '/skills',
  contact: '/contact',
  lost: '/404',
};

/** Names shown on beacons, the radar and the tour: the page, and the craft that hosts it */
export const stationNames: Record<StationKey, { page: string; craft: string }> = {
  home: { page: 'Home', craft: 'Gateway hub' },
  about: { page: 'About', craft: 'Crew habitat' },
  experience: { page: 'Experience', craft: 'Tether array' },
  projects: { page: 'Projects', craft: 'Fabrication yard' },
  skills: { page: 'Skills', craft: 'Research outpost' },
  contact: { page: 'Contact', craft: 'Comms array' },
  lost: { page: 'Lost signal', craft: 'Derelict' },
};

/** Stations you can fly to (the 404 derelict is only found by getting lost) */
export const navigableStations = stationKeys.filter((key) => key !== 'lost');

export function stationForPath(pathname: string): StationKey {
  if (pathname === '/') return 'home';
  const segment = pathname.split('/')[1] as StationKey;
  return stationKeys.includes(segment) && segment !== 'lost' && segment !== 'home'
    ? segment
    : 'lost';
}

/** GLB each station loads (optimised with scripts/optimize-models.mjs) */
export const stationModels: Partial<Record<StationKey, string>> = {
  home: '/static/models/astronaut.glb',
  about: '/static/models/helmet.glb',
  experience: '/static/models/satellite.glb',
  contact: '/static/models/rocket.glb',
  lost: '/static/models/astronaut.glb',
};

/** Matches World's `lite` flag: phones and touch devices get the lighter hulls */
export const liteQuery = '(max-width: 760px), (pointer: coarse)';

/**
 * Each station's hull (scripts/optimize-stations.mjs): hd for desktops,
 * sd (fewer triangles, smaller textures) for lite devices.
 */
export const hullUrl = (key: StationKey, lite: boolean) =>
  `/static/models/stations/${lite ? 'sd' : 'hd'}/${key}.glb`;

const prefetched = new Set<string>();

/**
 * What image fetches accept (the prefetch here and the decoder's fetches in
 * imageDecoder.ts). The image endpoint picks its output format from the
 * request's Accept header, and its responses vary on it: a bare fetch
 * accepts anything without naming WebP, so it could get the source format
 * back, and a prefetch sent with another Accept than the decode's missed
 * the HTTP cache
 */
export const imageAccept = 'image/webp,image/*;q=0.8';

/** Fetches a URL once, at low priority, into the HTTP cache (plain fetch, no three.js) */
export function prefetch(url: string) {
  if (prefetched.has(url)) return;
  prefetched.add(url);
  const headers = url.startsWith('/_next/image') ? { Accept: imageAccept } : undefined;
  fetch(url, { priority: 'low', headers } as RequestInit).catch(() => prefetched.delete(url));
}

/**
 * Warms the HTTP cache with the models for the station a link leads to, so
 * they are already downloaded when the camera arrives (instead of the
 * hologram placeholder showing mid-flight). Plain fetch, no three.js here.
 */
export function prefetchStationModel(pathname: string) {
  const key = stationForPath(pathname);
  const model = stationModels[key];
  if (model) prefetch(model);
  prefetch(hullUrl(key, window.matchMedia(liteQuery).matches));
}
