'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { ScrollReveal } from 'components/ScrollReveal/ScrollReveal';
import Magnet from 'components/Magnet/Magnet';

import { Skills as SkillsProps } from '@/types';

import './Skills.scss';

export const Skills = ({ skills }: { skills: SkillsProps }) => {
  const { title, label, tagline, marquee, categories, icons } = skills;
  const marqueeItems = [...marquee, ...marquee];

  return (
    <section id="skills" className="section skills" aria-labelledby="skills-heading">
      <span className="section__slug" aria-hidden="true">
        {'// skills'}
      </span>
      <ScrollReveal className="section__head section__head--centered">
        <span className="section__label section__label--centered">{label}</span>
        <h2 id="skills-heading" className="section__title">
          {title} &amp; <span className="section__title-accent">Stack</span>
        </h2>
        <p className="section__sub">{tagline}</p>
      </ScrollReveal>

      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {marqueeItems.map((m, i) => (
            <span className="marquee__item" key={`${m}-${i}`}>
              {m}
              <span className="marquee__sep" />
            </span>
          ))}
        </div>
      </div>

      <div className="skills__groups">
        {categories.map((cat, i) => {
          const catSkills = icons.filter((icon) => icon.category === cat.categoryKey);
          const wide = catSkills.length >= 12;
          return (
            <ScrollReveal
              key={cat.categoryKey}
              className={`skill-card${wide ? ' skill-card--wide' : ''}`}
              variant="scale"
              style={{ '--reveal-delay': `${i * 120}ms` } as React.CSSProperties}
              onMouseMove={(e: React.MouseEvent<HTMLElement>) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
              }}
            >
              <div className="skill-card__head">
                <Icon icon={cat.icon} width={28} height={28} aria-hidden="true" />
                <h3>{cat.title}</h3>
              </div>
              <div className="skill-card__grid">
                {catSkills.map((s) => {
                  const level = parseInt(s.level, 10) || 0;
                  const dots = Math.round(level / 20);
                  return (
                    <div className="skill-tile" key={s.name}>
                      <div className="skill-tile__inner">
                        <div className="skill-tile__front" aria-hidden="true">
                          <Icon icon={s.class} width={32} height={32} />
                        </div>
                        <div className="skill-tile__back" aria-hidden="true">
                          <span>{s.name}</span>
                          <span className="skill-tile__dots">
                            {Array.from({ length: 5 }, (_, d) => (
                              <span
                                key={d}
                                className={`skill-tile__dot${d < dots ? ' skill-tile__dot--filled' : ''}`}
                              />
                            ))}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollReveal>
          );
        })}
      </div>

      <ScrollReveal className="section__page-nav">
        <Magnet>
          <Link href="/contact" className="btn btn--primary">
            <Icon icon="ph:envelope-simple" width={18} height={18} aria-hidden="true" />
            <span>Get in Touch</span>
          </Link>
        </Magnet>
        <Magnet>
          <Link href="/projects" className="btn btn--secondary">
            <Icon icon="ph:folder-open" width={18} height={18} aria-hidden="true" />
            <span>View Projects</span>
          </Link>
        </Magnet>
      </ScrollReveal>
    </section>
  );
};

export default Skills;
