'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';

import { ScrollReveal } from 'components/ScrollReveal/ScrollReveal';
import Magnet from 'components/Magnet/Magnet';
import { Marquee } from 'components/Marquee/Marquee';

import { Skills as SkillsProps } from '@/types';

import './Skills.scss';

export const Skills = ({ skills }: { skills: SkillsProps }) => {
  const { title, label, tagline, marquee, categories, icons } = skills;

  return (
    <section id="skills" className="section skills" aria-labelledby="skills-heading">
      <span className="section__slug" aria-hidden="true">
        {'// skills'}
      </span>
      <ScrollReveal className="section__head section__head--centered">
        <span className="section__num" aria-hidden="true">
          04
        </span>
        <span className="section__label section__label--centered">{label}</span>
        <h2 id="skills-heading" className="section__title">
          {title} &amp; <span className="section__title-accent">Stack</span>
        </h2>
        <p className="section__sub">{tagline}</p>
      </ScrollReveal>

      <Marquee items={marquee} className="skills__marquee" duration={52} reverse />

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
            >
              <div className="skill-card__head">
                <Icon icon={cat.icon} width={22} height={22} aria-hidden="true" />
                <h3>{cat.title}</h3>
                <span className="skill-card__count" aria-hidden="true">
                  ({String(catSkills.length).padStart(2, '0')})
                </span>
              </div>
              <div className="skill-card__grid">
                {catSkills.map((s) => {
                  const level = parseInt(s.level, 10) || 0;
                  const dots = Math.round(level / 20);
                  return (
                    <div className="skill-tile" key={s.name}>
                      <Icon icon={s.class} width={26} height={26} aria-hidden="true" />
                      <span className="skill-tile__name">{s.name}</span>
                      <span
                        className="skill-tile__dots"
                        aria-label={`Proficiency ${dots} out of 5`}
                        role="img"
                      >
                        {Array.from({ length: 5 }, (_, d) => (
                          <span
                            key={d}
                            className={`skill-tile__dot${d < dots ? ' skill-tile__dot--filled' : ''}`}
                          />
                        ))}
                      </span>
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
