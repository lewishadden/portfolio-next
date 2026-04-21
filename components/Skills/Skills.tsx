'use client';

import { Icon } from '@iconify/react';
import { ScrollReveal } from 'components/ScrollReveal/ScrollReveal';

import { Skills as SkillsProps } from '@/types';

import './Skills.scss';

export const Skills = ({ skills }: { skills: SkillsProps }) => {
  const { title, label, tagline, marquee, categories, icons } = skills;
  const marqueeItems = [...marquee, ...marquee];

  return (
    <section id="skills" className="section skills" aria-labelledby="skills-heading">
      <div className="section__num">04</div>
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
          return (
            <ScrollReveal
              key={cat.categoryKey}
              className="skill-card"
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
                {catSkills.map((s) => (
                  <div className="skill-tile" key={s.name}>
                    <div className="skill-tile__inner">
                      <div className="skill-tile__front" aria-hidden="true">
                        <Icon icon={s.class} width={32} height={32} />
                      </div>
                      <div className="skill-tile__back" aria-hidden="true">
                        <span>{s.name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
};

export default Skills;
