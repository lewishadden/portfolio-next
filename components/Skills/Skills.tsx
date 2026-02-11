'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

import { BasicInfo, Skills as ISkills } from '@/types';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';

import './Skills.scss';

const staggerDelay = 0.1;

const breakpoints = [
  { min: 1200, cols: 8 },
  { min: 992, cols: 6 },
  { min: 768, cols: 5 },
  { min: 480, cols: 4 },
  { min: 0, cols: 3 },
];

const getColumns = (width: number) =>
  (breakpoints.find((bp) => width >= bp.min) ?? breakpoints[breakpoints.length - 1]).cols;

/**
 * Splits items into rows with a reverse-pyramid taper at the bottom.
 * Full rows fill to `cols`. When there is a remainder, one full row is
 * borrowed and combined with the leftover to form two balanced, centered
 * taper rows (e.g. 8+5 → 7+6).
 */
const buildPyramidRows = <T,>(items: T[], cols: number): T[][] => {
  const total = items.length;
  if (total === 0) return [];

  const rows: T[][] = [];
  const remainder = total % cols;
  let offset = 0;

  if (remainder === 0) {
    for (let r = 0; r < total / cols; r += 1) {
      rows.push(items.slice(offset, offset + cols));
      offset += cols;
    }
    return rows;
  }

  const fullRowsAvailable = Math.floor(total / cols);

  // Not enough items for even one full row — single centered row
  if (fullRowsAvailable === 0) {
    return [items.slice(0)];
  }

  // Borrow one full row; split pool into two balanced taper rows
  const fullRowCount = fullRowsAvailable - 1;
  const pool = cols + remainder;
  const firstTaper = Math.ceil(pool / 2);
  const secondTaper = pool - firstTaper;

  for (let r = 0; r < fullRowCount; r += 1) {
    rows.push(items.slice(offset, offset + cols));
    offset += cols;
  }

  rows.push(items.slice(offset, offset + firstTaper));
  offset += firstTaper;

  if (secondTaper > 0) {
    rows.push(items.slice(offset, offset + secondTaper));
  }

  return rows;
};

export const Skills = ({ skills, basicInfo }: { skills: ISkills; basicInfo: BasicInfo }) => {
  const headingText = basicInfo.sectionName.skills;
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const update = () => setColumns(getColumns(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const icons = skills?.icons ?? [];
  const pyramidRows = buildPyramidRows(icons, columns);
  let globalIndex = 0;

  return (
    <section id="skills" className="skills" aria-labelledby="skills-heading">
      <div className="skills__container">
        <div className="skills__heading-wrapper">
          <span className="skills__label">My toolkit</span>
          <h2 id="skills-heading" className="skills__title">
            {headingText}
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
