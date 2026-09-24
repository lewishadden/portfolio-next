'use client';

import { useId } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { m } from 'framer-motion';

import Magnet from 'components/Magnet/Magnet';
import { Marquee } from 'components/Marquee/Marquee';
import { PageHead } from 'components/PageHead/PageHead';
import { Reveal, RevealGroup, RevealItem } from 'components/Motion/Reveal';

import { usePointerGlow } from '@/hooks/usePointerGlow';

import type { Variants } from 'framer-motion';
import type { SkillCategory, SkillIcon, Skills as SkillsProps } from '@/types';

import './Skills.scss';

const ease = [0.16, 1, 0.3, 1] as const;

/** "80%" / "80" → 80, clamped to 0–100 */
const parseLevel = (level: string) => Math.max(0, Math.min(100, parseInt(level, 10) || 0));

/** Grows with its tile's reveal (it inherits the RevealGroup stagger) */
const meterVariants: Variants = {
  hidden: { scaleX: 0 },
  shown: { scaleX: 1, transition: { duration: 1.4, ease } },
};

const SkillTile = ({ skill }: { skill: SkillIcon }) => {
  const level = parseLevel(skill.level);
  return (
    <RevealItem as="li" className="skills__tile-cell" y={24}>
      <div className="skills__tile">
        <span className="skills__tile-icon" aria-hidden="true">
          <Icon icon={skill.class} width={26} height={26} />
        </span>
        <span className="skills__tile-level" aria-hidden="true">
          {level}
          <small>%</small>
        </span>
        <span className="skills__tile-name">
          {skill.name}
          <span className="sr-only">, proficiency {level}%</span>
        </span>
        <span className="skills__meter" aria-hidden="true">
          <m.span
            className="skills__meter-fill"
            style={{ width: `${level}%` }}
            variants={meterVariants}
          />
        </span>
      </div>
    </RevealItem>
  );
};

/** Ring gauge of a category's average proficiency (decorative; the value is also in text) */
const Gauge = ({ value }: { value: number }) => {
  const gradientId = `gauge-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <span className="skills__gauge" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" className="skills__gauge-stop skills__gauge-stop--start" />
            <stop offset="100%" className="skills__gauge-stop skills__gauge-stop--end" />
          </linearGradient>
        </defs>
        <circle className="skills__gauge-track" cx="24" cy="24" r="20" />
        <m.circle
          className="skills__gauge-arc"
          cx="24"
          cy="24"
          r="20"
          stroke={`url(#${gradientId})`}
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: value / 100 }}
          viewport={{ once: true }}
          transition={{ duration: 1.8, ease, delay: 0.3 }}
        />
      </svg>
      <span className="skills__gauge-value">{value}</span>
    </span>
  );
};

const CategoryCard = ({
  category,
  skills,
  span,
  index,
}: {
  category: SkillCategory;
  skills: SkillIcon[];
  span: number;
  index: number;
}) => {
  const ref = usePointerGlow<HTMLDivElement>({ tilt: 2 });
  const headingId = `skills-${category.categoryKey}`;
  const average = Math.round(
    skills.reduce((sum, s) => sum + parseLevel(s.level), 0) / Math.max(skills.length, 1)
  );

  return (
    <Reveal
      as="article"
      className={`skills__cell skills__cell--span-${span}`}
      aria-labelledby={headingId}
      y={60}
      scale={0.96}
      delay={(index % 2) * 0.12}
    >
      <div className="skills__card glass spotlight" ref={ref}>
        <header className="skills__card-head">
          <span className="skills__card-icon" aria-hidden="true">
            <Icon icon={category.icon} width={24} height={24} />
          </span>
          <div className="skills__card-titles">
            <h2 id={headingId} className="skills__card-title">
              {category.title}
            </h2>
            <p className="skills__card-meta">
              <span className="chip skills__count">
                <b>{String(skills.length).padStart(2, '0')}</b> tools
              </span>
              <span className="skills__avg">average {average}%</span>
            </p>
          </div>
          <Gauge value={average} />
        </header>

        <RevealGroup as="ul" className="skills__tiles" stagger={0.035} delay={0.15}>
          {skills.map((skill) => (
            <SkillTile key={skill.name} skill={skill} />
          ))}
        </RevealGroup>
      </div>
    </Reveal>
  );
};

export const Skills = ({ skills }: { skills: SkillsProps }) => {
  const { label, tagline, marquee, categories, icons } = skills;

  const groups = categories.map((category) => ({
    category,
    skills: icons.filter((icon) => icon.category === category.categoryKey),
  }));

  // Bento rows of two on a 12-column grid: each pair splits the row in
  // proportion to its skill counts (4–8 columns each) so the category with the
  // most skills gets the most room and paired cards end up a similar height.
  const spans = groups.map((group, i) => {
    const partner = groups[i % 2 ? i - 1 : i + 1];
    if (!partner) return 12;
    const share = group.skills.length / Math.max(group.skills.length + partner.skills.length, 1);
    const cols = i % 2 ? 12 - Math.round(12 * (1 - share)) : Math.round(12 * share);
    return Math.max(4, Math.min(8, cols));
  });

  // Offset the second band so the two rows never show the same word together
  const half = Math.floor(marquee.length / 2);
  const counterMarquee = [...marquee.slice(half), ...marquee.slice(0, half)];

  return (
    <section id="skills" className="page skills" aria-labelledby="skills-heading">
      <PageHead
        id="skills-heading"
        index="04"
        label={label}
        title="Tech"
        accent="stack"
        sub={tagline}
      >
        <Reveal as="ul" className="skills__stats" delay={0.24} aria-label="At a glance">
          <li className="skills__stat">
            <b>{icons.length}</b> technologies
          </li>
          <li className="skills__stat">
            <b>{String(categories.length).padStart(2, '0')}</b> disciplines
          </li>
        </Reveal>
      </PageHead>

      <Reveal className="skills__bands" y={0} blur={false}>
        <div className="skills__band skills__band--a">
          <Marquee items={marquee} duration={48} label="Core technologies" />
        </div>
        <div className="skills__band skills__band--b" aria-hidden="true">
          <Marquee items={counterMarquee} duration={64} separator="/" reverse />
        </div>
      </Reveal>

      <div className="skills__grid">
        {groups.map((group, i) => (
          <CategoryCard
            key={group.category.categoryKey}
            category={group.category}
            skills={group.skills}
            span={spans[i]}
            index={i}
          />
        ))}
      </div>

      <Reveal as="div" className="page-nav">
        <Magnet>
          <Link href="/contact" className="btn btn--primary">
            <Icon icon="ph:paper-plane-tilt-bold" width={18} height={18} aria-hidden="true" />
            <span>Get in touch</span>
            <Icon icon="ph:arrow-right-bold" width={16} height={16} aria-hidden="true" />
          </Link>
        </Magnet>
        <Magnet>
          <Link href="/projects" className="btn btn--ghost">
            <Icon icon="ph:cube-focus-bold" width={18} height={18} aria-hidden="true" />
            <span>View projects</span>
          </Link>
        </Magnet>
      </Reveal>
    </section>
  );
};

export default Skills;
