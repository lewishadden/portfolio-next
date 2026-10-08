'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';

import Magnet from 'components/Magnet/Magnet';
import { Marquee } from 'components/Marquee/Marquee';
import { PageHead } from 'components/PageHead/PageHead';
import { Reveal, RevealGroup, RevealItem } from 'components/Motion/Reveal';
import { inspectEntity } from 'components/World/inspection';

import { usePointerGlow } from '@/hooks/usePointerGlow';

import type { InspectionSkill } from 'components/World/inspectionTypes';
import type { SkillCategory, SkillIcon, Skills as SkillsProps } from '@/types';

import './Skills.scss';

const SkillTile = ({ skill, evidence }: { skill: SkillIcon; evidence?: InspectionSkill }) => {
  const projectCount = evidence?.projects.length ?? 0;
  const roleCount = evidence?.roles.length ?? 0;
  const summary = projectCount || roleCount
    ? [projectCount ? `${projectCount} project${projectCount === 1 ? '' : 's'}` : '', roleCount ? `${roleCount} role${roleCount === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')
    : 'Explore skill';
  return (
    <RevealItem as="li" className="skills__tile-cell" y={24}>
      <button
        type="button"
        className="skills__tile"
        data-world-target={`skill:${skill.name}`}
        aria-label={`Inspect ${skill.name}: ${summary}`}
        aria-haspopup="dialog"
        onClick={() => inspectEntity({ kind: 'skill', id: skill.name, station: 'skills' })}
      >
        <span className="skills__tile-icon" aria-hidden="true">
          <Icon icon={skill.class} width={26} height={26} />
        </span>
        <Icon className="skills__tile-arrow" icon="ph:arrow-up-right-bold" width={14} height={14} aria-hidden="true" />
        <span className="skills__tile-name">{skill.name}</span>
        <span className="skills__tile-evidence">{summary}</span>
      </button>
    </RevealItem>
  );
};

const CategoryCard = ({
  category,
  skills,
  span,
  index,
  evidence,
}: {
  category: SkillCategory;
  skills: SkillIcon[];
  span: number;
  index: number;
  evidence: InspectionSkill[];
}) => {
  const ref = usePointerGlow<HTMLDivElement>({ tilt: 2 });
  const headingId = `skills-${category.categoryKey}`;
  const projectCount = new Set(evidence.filter((item) => skills.some((skill) => skill.name === item.id)).flatMap((item) => item.projects)).size;

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
              <span className="skills__proof">{projectCount} linked projects</span>
            </p>
          </div>
        </header>

        <RevealGroup as="ul" className="skills__tiles" stagger={0.035} delay={0.15}>
          {skills.map((skill) => (
            <SkillTile key={skill.name} skill={skill} evidence={evidence.find((item) => item.id === skill.name)} />
          ))}
        </RevealGroup>
      </div>
    </Reveal>
  );
};

export const Skills = ({ skills, evidence = [] }: { skills: SkillsProps; evidence?: InspectionSkill[] }) => {
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

      <p className="skills__evidence-intro">Select a technology to explore the projects and roles that demonstrate it.</p>
      <div className="skills__grid">
        {groups.map((group, i) => (
          <CategoryCard
            key={group.category.categoryKey}
            category={group.category}
            skills={group.skills}
            span={spans[i]}
            index={i}
            evidence={evidence}
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

