'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { m } from 'framer-motion';

import Magnet from 'components/Magnet/Magnet';
import { Marquee } from 'components/Marquee/Marquee';
import { PageHead } from 'components/PageHead/PageHead';
import { Reveal, RevealGroup, RevealItem } from 'components/Motion/Reveal';
import { useBooted } from 'components/World/boot';

import { usePointerGlow } from '@/hooks/usePointerGlow';

import type { FocusEvent, KeyboardEvent } from 'react';
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

/**
 * Where an arrow key (or Home / End) moves focus among a category's tiles,
 * or -1 for a key that doesn't move it. Up and down go to the nearest tile
 * in the row above or below, as the tiles wrap at this width.
 */
function tileFor(key: string, tiles: HTMLElement[], from: number) {
  const last = tiles.length - 1;
  switch (key) {
    case 'ArrowRight':
      return Math.min(from + 1, last);
    case 'ArrowLeft':
      return Math.max(from - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'ArrowDown':
    case 'ArrowUp': {
      const down = key === 'ArrowDown';
      const here = tiles[from].getBoundingClientRect();
      const rects = tiles.map((tile) => tile.getBoundingClientRect());
      // The top of the next row that way
      let row = down ? Infinity : -Infinity;
      for (const { top } of rects) {
        if (down ? top > here.top + 1 && top < row : top < here.top - 1 && top > row) row = top;
      }
      if (!Number.isFinite(row)) return from;
      const centre = here.left + here.width / 2;
      let nearest = from;
      let gap = Infinity;
      rects.forEach((rect, i) => {
        const dx = Math.abs(rect.left + rect.width / 2 - centre);
        if (Math.abs(rect.top - row) <= 1 && dx < gap) {
          gap = dx;
          nearest = i;
        }
      });
      return nearest;
    }
    default:
      return -1;
  }
}

const tilesIn = (list: HTMLElement) => [...list.querySelectorAll<HTMLElement>('.skills__tile')];

const SkillTile = ({ skill, current }: { skill: SkillIcon; current: boolean }) => {
  const level = parseLevel(skill.level);
  const levelId = useId();
  return (
    <RevealItem as="li" className="skills__tile-cell" y={24}>
      {/* Focusable (a roving tab stop) so the keyboard can light its badge in
          the constellation, as hovering does; its level is its description */}
      <div
        className="skills__tile"
        data-world-target={`skill:${skill.name}`}
        tabIndex={current ? 0 : -1}
        aria-describedby={levelId}
      >
        <span className="skills__tile-icon" aria-hidden="true">
          <Icon icon={skill.class} width={26} height={26} />
        </span>
        <span className="skills__tile-level" aria-hidden="true">
          {level}
          <small>%</small>
        </span>
        <span className="skills__tile-name">{skill.name}</span>
        <span className="skills__meter" aria-hidden="true">
          <m.span
            className="skills__meter-fill"
            style={{ width: `${level}%` }}
            variants={meterVariants}
          />
        </span>
      </div>
      <span id={levelId} className="sr-only">
        Proficiency {level}%
      </span>
    </RevealItem>
  );
};

/** Ring gauge of a category's average proficiency (decorative; the value is also in text) */
const Gauge = ({ value }: { value: number }) => {
  const gradientId = `gauge-${useId().replace(/[^\w-]/g, '')}`;
  const booted = useBooted();
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
          whileInView={booted ? { pathLength: value / 100 } : undefined}
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
  // One tab stop per category: the tile last focused (the first to begin with)
  const [current, setCurrent] = useState(0);

  const onTileKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tiles = tilesIn(e.currentTarget);
    const from = tiles.indexOf(e.target as HTMLElement);
    if (from < 0) return;
    const to = tileFor(e.key, tiles, from);
    if (to < 0) return;
    // Arrow keys move between tiles here, not the page
    e.preventDefault();
    tiles[to].focus();
  };

  const onTileFocus = (e: FocusEvent<HTMLElement>) => {
    const index = tilesIn(e.currentTarget).indexOf(e.target as HTMLElement);
    if (index >= 0) setCurrent(index);
  };
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
      <div
        className="skills__card glass spotlight"
        ref={ref}
        data-world-category={category.categoryKey}
      >
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

        <RevealGroup
          as="ul"
          className="skills__tiles"
          stagger={0.035}
          delay={0.15}
          onKeyDown={onTileKey}
          onFocus={onTileFocus}
        >
          {skills.map((skill, i) => (
            <SkillTile key={skill.name} skill={skill} current={i === current} />
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
