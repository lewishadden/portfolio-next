'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { ScrollReveal } from 'components/ScrollReveal/ScrollReveal';

import { Experience as ExperienceProps } from '@/types';

import './Experience.scss';

export const Experience = ({ experience }: { experience: ExperienceProps }) => {
  const { title, label, items, done } = experience;
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const el = railRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const anchor = vh * 0.6;
      const pct = Math.max(0, Math.min(100, ((anchor - r.top) / r.height) * 100));
      el.style.setProperty('--rail-fill', `${pct}%`);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section id="experience" className="section xp" aria-labelledby="experience-heading">
      <div className="section__num">02</div>
      <ScrollReveal className="section__head section__head--centered">
        <span className="section__label section__label--centered">{label}</span>
        <h2 id="experience-heading" className="section__title">
          {title}
        </h2>
        <p className="section__sub">
          Almost a decade across IBM, Sopra Steria, ERGO Travel and ADP — frontend, full stack, and
          cloud architecture.
        </p>
      </ScrollReveal>

      <div className="xp__timeline">
        <div className="xp__rail" ref={railRef} aria-hidden="true" />
        <ol className="xp__items">
          {items.map((item, i) => (
            <ScrollReveal
              as="li"
              key={`${item.company}-${item.years}`}
              className={`xp__item xp__item--${i % 2 === 0 ? 'left' : 'right'}`}
            >
              <div
                className="xp__content"
                onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                  e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
                }}
              >
                <div className="xp__date">{item.years}</div>
                <h3 className="xp__role">{item.title}</h3>
                <p className="xp__co">{item.company}</p>
                {item.description && (
                  <p className="xp__desc">{item.description}</p>
                )}
                <div className="xp__tech">
                  {item.mainTech.map((t) => (
                    <span className="chip" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="xp__dot" aria-hidden="true">
                <Icon icon={item.icon} width={22} height={22} />
              </div>
            </ScrollReveal>
          ))}
        </ol>
        <div className="xp__end">
          <span className="xp__end-dot">
            <Icon icon={done.icon} width={22} height={22} aria-hidden="true" />
          </span>
        </div>
      </div>
    </section>
  );
};

export default Experience;
