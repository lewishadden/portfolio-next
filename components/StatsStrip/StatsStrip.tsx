'use client';

import { useCountUp } from '@/hooks/useCountUp';
import { StatItem } from '@/types';

import './StatsStrip.scss';

const StatCell = ({ value, suffix, label }: StatItem) => {
  const [v, ref] = useCountUp<HTMLDivElement>(value);
  return (
    <div className="stats__item" ref={ref}>
      <div className="stats__value">
        {v}
        {suffix}
      </div>
      <div className="stats__label">{label}</div>
    </div>
  );
};

export const StatsStrip = ({ stats }: { stats: StatItem[] }) => (
  <section className="stats" aria-label="Key stats">
    {stats.map((s, i) => (
      <StatCell key={`${s.label}-${i}`} {...s} />
    ))}
  </section>
);

export default StatsStrip;
