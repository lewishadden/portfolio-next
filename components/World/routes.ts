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

function prefetch(url: string) {
  if (prefetched.has(url)) return;
  prefetched.add(url);
  fetch(url, { priority: 'low' } as RequestInit).catch(() => prefetched.delete(url));
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
