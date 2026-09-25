/**
 * Adaptive rendering quality. WorldCanvas starts at the device's default tier
 * and drei's PerformanceMonitor steps it down when the frame rate stays low
 * (and back up when there is headroom).
 */
export type QualityTier = 'high' | 'medium' | 'low';

export const tierSettings: Record<QualityTier, { dpr: number }> = {
  high: { dpr: 1.5 },
  medium: { dpr: 1.25 },
  low: { dpr: 1 },
};

export const lowerTier = (tier: QualityTier): QualityTier => (tier === 'high' ? 'medium' : 'low');

export const raiseTier = (tier: QualityTier, ceiling: QualityTier): QualityTier => {
  const order: QualityTier[] = ['low', 'medium', 'high'];
  return order[Math.min(order.indexOf(tier) + 1, order.indexOf(ceiling))];
};
