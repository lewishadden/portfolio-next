/**
 * Adaptive rendering quality. WorldCanvas starts at the device's default tier
 * and drei's PerformanceMonitor steps it down when the frame rate stays low
 * (and back up when there is headroom). Tiers differ in cost only: the pixel
 * ratio and bloom's working resolution here, and fringes and sun shafts off
 * below high (Effects).
 *
 * Ultra renders a retina screen at its full 2x, with bloom at 0.6 of it. It
 * sits above high only on desktops whose canvas at 2x stays within
 * `ultraPixels`, is reached only by an incline from high, and once a session
 * has fallen out of it (the device couldn't hold it), high is its ceiling.
 */
export type QualityTier = 'ultra' | 'high' | 'medium' | 'low';

/** Lowest first */
const order: QualityTier[] = ['low', 'medium', 'high', 'ultra'];

export const tierSettings: Record<QualityTier, { dpr: number; bloomScale: number }> = {
  ultra: { dpr: 2, bloomScale: 0.6 },
  high: { dpr: 1.5, bloomScale: 0.5 },
  medium: { dpr: 1.25, bloomScale: 0.5 },
  low: { dpr: 1, bloomScale: 0.25 },
};

/** Position in the order, lowest 0 */
export const tierRank = (tier: QualityTier) => order.indexOf(tier);

export const lowerTier = (tier: QualityTier): QualityTier => order[Math.max(tierRank(tier) - 1, 0)];

export const raiseTier = (tier: QualityTier, ceiling: QualityTier): QualityTier =>
  order[Math.min(tierRank(tier) + 1, tierRank(ceiling))];

/** The most canvas pixels ultra draws (the screen at 2x): 1280×800 fits, 1440×900 doesn't */
const ultraPixels = 4_500_000;

/** Whether this screen can take ultra: a retina screen, small enough at 2x (a resize can change it) */
export function ultraFits() {
  return window.devicePixelRatio >= 2 && window.innerWidth * window.innerHeight * 4 <= ultraPixels;
}

/** For useSyncExternalStore: the screen's size or pixel ratio changed */
export function subscribeScreen(listener: () => void) {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

/** Set once the session has fallen out of ultra; outlives the canvas (switching the world off and on) */
let ultraLost = false;

export const hasLostUltra = () => ultraLost;

export function loseUltra() {
  ultraLost = true;
}
