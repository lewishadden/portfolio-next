'use client';

import { Icon } from '@iconify/react';

import { useColumns } from '@/hooks/useColumns';
import { buildPyramidRows } from '@/utils/buildPyramidRows';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';

import { Skills as SkillsProps } from '@/types';

import './Skills.scss';

const staggerDelay = 0.1;

const breakpoints = [
  { min: 1200, cols: 8 },
  { min: 992, cols: 6 },
  { min: 768, cols: 5 },
  { min: 480, cols: 4 },
  { min: 0, cols: 3 },
];

export const Skills = ({ skills }: { skills: SkillsProps }) => {
  const { title, label, icons } = skills;

  const columns = useColumns(breakpoints);

  const pyramidRows = buildPyramidRows(icons, columns);
  let globalIndex = 0;

  return (
    <section id="skills" className="skills" aria-labelledby="skills-heading">
      <div className="skills__container">
        <div className="skills__heading-wrapper">
          <span className="skills__label">{label}</span>
          <h2 id="skills-heading" className="skills__title">
            {title}
          </h2>
        </div>
        <div className="skills__list" aria-label="Technical skills" role="list">
          {pyramidRows.map((row, rowIndex) => (
            <div key={rowIndex} className="skills__list__row">
              {row.map((skill, colIndex) => {
                const i = globalIndex;
                globalIndex += 1;
                return (
                  <div key={i} className="skills__list__tile" role="listitem">
                    <ScrollReveal animation="flipInX" delay={colIndex * staggerDelay}>
                      <div className="skills__list__tile__icon-wrapper">
                        <Icon
                          icon={skill.class}
                          className="skills__list__tile__icon"
                          aria-hidden="true"
                        />
                        <div className="skills__list__tile__icon-glow"></div>
                      </div>
                      <p className="skills__list__tile__name" title={skill.name}>
                        {skill.name}
                      </p>
                    </ScrollReveal>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Skills;
