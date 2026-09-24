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
