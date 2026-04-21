import { Icon } from '@iconify/react';

import { Skills as SkillsProps } from '@/types';

import './Skills.scss';

export const Skills = ({ skills }: { skills: SkillsProps }) => {
  const { title, label, tagline, marquee, categories, icons } = skills;
  const marqueeItems = [...marquee, ...marquee];

  return (
    <section id="skills" className="section skills" aria-labelledby="skills-heading">
      <div className="section__num">04</div>
      <div className="section__head section__head--centered reveal">
        <span className="section__label section__label--centered">{label}</span>
        <h2 id="skills-heading" className="section__title">
          {title} &amp; <span className="section__title-accent">Stack</span>
        </h2>
        <p className="section__sub">{tagline}</p>
      </div>

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
            <div
              key={cat.categoryKey}
              className="skill-card reveal"
              style={{ '--reveal-delay': `${i * 120}ms` } as React.CSSProperties}
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
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default Skills;
