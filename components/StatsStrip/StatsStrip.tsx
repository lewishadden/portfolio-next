'use client';

import { RevealGroup, RevealItem } from 'components/Motion/Reveal';

import { useCountUp } from '@/hooks/useCountUp';
import { usePointerGlow } from '@/hooks/usePointerGlow';
import { StatItem } from '@/types';

import './StatsStrip.scss';

const StatCell = ({ value, suffix, label, index }: StatItem & { index: number }) => {
  const [v, ref] = useCountUp<HTMLDivElement>(value);
  const glowRef = usePointerGlow<HTMLDivElement>({ tilt: 8 });

  return (
    <RevealItem className="stats__cell">
      <div className="stats__item glass spotlight" ref={glowRef}>
        <span className="stats__index" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="stats__value" ref={ref}>
          <span className="text-gradient">
            {v}
            {suffix}
          </span>
        </div>
        <div className="stats__label">{label}</div>
        <svg className="stats__orbit" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" />
          <circle cx="50" cy="50" r="46" className="stats__orbit-arc" />
        </svg>
      </div>
    </RevealItem>
  );
};

export const StatsStrip = ({ stats }: { stats: StatItem[] }) => (
  <section className="stats" aria-label="Key stats">
    <RevealGroup className="stats__grid" stagger={0.1}>
      {stats.map((s, i) => (
        <StatCell key={`${s.label}-${i}`} {...s} index={i} />
      ))}
    </RevealGroup>
  </section>
);

export default StatsStrip;
