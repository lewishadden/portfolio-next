'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

import { useColumns } from '@/hooks/useColumns';
import { buildPyramidRows } from '@/utils/buildPyramidRows';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';

import { Icon as IconType, Skills as SkillsProps } from '@/types';

import './Skills.scss';

const topSkillsCount = 16;
const staggerDelay = 0.1;

const breakpoints = [
  { min: 1200, cols: 8 },
  { min: 992, cols: 6 },
  { min: 768, cols: 5 },
  { min: 480, cols: 4 },
  { min: 0, cols: 3 },
];

function sortByLevelDesc(a: IconType, b: IconType): number {
  return parseInt(b.level, 10) - parseInt(a.level, 10);
}

export const Skills = ({ skills }: { skills: SkillsProps }) => {
  const { title, label, icons } = skills;
  const [expanded, setExpanded] = useState(false);

  const sortedIcons = [...icons].sort(sortByLevelDesc);
  const topIcons = sortedIcons.slice(0, topSkillsCount);
  const restIcons = sortedIcons.slice(topSkillsCount);
  const displayedIcons = expanded ? sortedIcons : topIcons;
  const hasMore = restIcons.length > 0;

  const columns = useColumns(breakpoints);
  const pyramidRows = buildPyramidRows(displayedIcons, columns);
  let globalIndex = 0;

  return (
    <section id="skills" className="skills" aria-labelledby="skills-heading">
      <div className="skills__container">
        <div className="skills__heading-wrapper">
          <ScrollReveal animation="slideUp">
            <span className="skills__label">{label}</span>
          </ScrollReveal>
          <ScrollReveal animation="slideUp" delay={0.1}>
            <h2 id="skills-heading" className="skills__title">
              {title}
            </h2>
          </ScrollReveal>
        </div>
        <div id="skills-list" className="skills__list" aria-label="Technical skills" role="list">
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
                        <div className="skills__list__tile__icon-glow" />
                      </div>
                      <p className="skills__list__tile__name" title={skill.name}>
                        {skill.name}
                      </p>
                      <div className="skills__list__tile__tooltip" aria-hidden="true">
                        <div className="skills__list__tile__tooltip__bar">
                          <div
                            className="skills__list__tile__tooltip__fill"
                            style={{ width: `${skill.level}%` }}
                          />
                        </div>
                        <span className="skills__list__tile__tooltip__label">{skill.level}%</span>
                      </div>
                    </ScrollReveal>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {hasMore && (
          <div className="skills__expand-wrapper">
            <button
              type="button"
              className="skills__expand-btn"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              aria-controls="skills-list"
            >
              {expanded ? 'Show less' : `Show ${restIcons.length} more`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default Skills;
