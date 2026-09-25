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
  projects: '/static/models/terminal.glb',
  contact: '/static/models/rocket.glb',
  lost: '/static/models/astronaut.glb',
};

const prefetched = new Set<string>();

/**
 * Warms the HTTP cache with the model for the station a link leads to, so it
 * is already downloaded when the camera arrives (instead of the hologram
 * placeholder showing mid-flight). Plain fetch — no three.js needed here.
 */
export function prefetchStationModel(pathname: string) {
  const url = stationModels[stationForPath(pathname)];
  if (!url || prefetched.has(url)) return;
  prefetched.add(url);
  fetch(url, { priority: 'low' } as RequestInit).catch(() => prefetched.delete(url));
}
