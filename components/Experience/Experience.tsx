'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';

import { ScrollReveal } from 'components/ScrollReveal/ScrollReveal';
import Magnet from 'components/Magnet/Magnet';

import { Experience as ExperienceProps } from '@/types';

import './Experience.scss';

const companyAbbreviations: Record<string, string> = {
  ADP: 'ADP',
  'ERGO Travel Insurance': 'ERGO',
  'Sopra Steria': 'SS',
  IBM: 'IBM',
};

const getCompanyInitials = (company: string): string =>
  companyAbbreviations[company] || company.slice(0, 2).toUpperCase();

export const Experience = ({ experience }: { experience: ExperienceProps }) => {
  const { title, label, items } = experience;
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
      <span className="section__slug" aria-hidden="true">
        {'// experience'}
      </span>
      <ScrollReveal className="section__head">
        <span className="section__num" aria-hidden="true">
          02
        </span>
        <span className="section__label">{label}</span>
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
            <li key={`${item.company}-${item.years}`} className="xp__item">
              <div className="xp__dot" aria-hidden="true">
                <span className="xp__dot-text">{getCompanyInitials(item.company)}</span>
              </div>
              <ScrollReveal className="xp__content" variant="slide-right">
                <div className="xp__meta">
                  <span className="xp__index" aria-hidden="true">
                    {String(items.length - i).padStart(2, '0')}
                  </span>
                  <span className="xp__date">{item.years}</span>
                </div>
                <h3 className="xp__role">{item.title}</h3>
                <p className="xp__co">{item.company}</p>
                {item.description && <p className="xp__desc">{item.description}</p>}
                <div className="xp__tech">
                  {item.mainTech.map((t) => (
                    <span className="chip" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </ScrollReveal>
            </li>
          ))}
        </ol>
        <p className="xp__end" aria-hidden="true">
          — began <span className="xp__end-year">2018</span>, still shipping
        </p>
      </div>

      <ScrollReveal className="section__page-nav">
        <Magnet>
          <Link href="/projects" className="btn btn--primary">
            <Icon icon="ph:folder-open" width={18} height={18} aria-hidden="true" />
            <span>See Projects</span>
          </Link>
        </Magnet>
        <Magnet>
          <Link href="/contact" className="btn btn--secondary">
            <Icon icon="ph:envelope-simple" width={18} height={18} aria-hidden="true" />
            <span>Work Together</span>
          </Link>
        </Magnet>
      </ScrollReveal>
    </section>
  );
};

export default Experience;
