'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';

import Magnet from 'components/Magnet/Magnet';
import { PageHead } from 'components/PageHead/PageHead';
import { Reveal } from 'components/Motion/Reveal';
import { ProjectBody, pad, useSlides } from '../ProjectBody/ProjectBody';

import { usePointerGlow } from '@/hooks/usePointerGlow';
import { projectPath } from '@/utils/projectPaths';

import type { Project } from '@/types';

import './ProjectPage.scss';

export interface ProjectNeighbour {
  project: Project;
  /** 1-based position in the full project list */
  number: number;
}

/** "Audi Form Builder" → lead "Audi Form", gradient accent "Builder" */
function splitTitle(title: string) {
  const words = title.trim().split(/\s+/);
  const accent = words.pop() ?? '';
  return { lead: words.join(' '), accent };
}

const PagerLink = ({
  neighbour: { project, number },
  direction,
}: {
  neighbour: ProjectNeighbour;
  direction: 'prev' | 'next';
}) => {
  const ref = usePointerGlow<HTMLAnchorElement>();
  const next = direction === 'next';

  return (
    <Link
      ref={ref}
      href={projectPath(project.slug)}
      rel={direction}
      className={`project-pager__link project-pager__link--${direction} glass spotlight`}
    >
      <span className="project-pager__dir">
        {!next && <Icon icon="ph:arrow-left-bold" width={14} height={14} aria-hidden="true" />}
        {next ? 'Next project' : 'Previous project'}
        {next && <Icon icon="ph:arrow-right-bold" width={14} height={14} aria-hidden="true" />}
      </span>
      <span className="project-pager__title">
        <span className="project-pager__no" aria-hidden="true">
          {`№${pad(number)}`}
        </span>
        {project.title.trim()}
      </span>
      <span className="project-pager__year">{project.startDate}</span>
    </Link>
  );
};

/** Standalone /projects/[slug] page — the same body as the grid's modal, as a full page */
export function ProjectPage({
  project,
  number,
  total,
  previous,
  next,
}: {
  project: Project;
  number: number;
  total: number;
  previous: ProjectNeighbour;
  next: ProjectNeighbour;
}) {
  const slides = useSlides(project.images.length);
  const name = project.title.trim();
  const { lead, accent } = splitTitle(name);

  return (
    <article className="page project-page" aria-labelledby="project-heading">
      <Reveal as="nav" className="project-page__crumbs" aria-label="Breadcrumb" y={12}>
        <ol>
          <li>
            <Link href="/projects">
              <Icon icon="ph:arrow-left-bold" width={14} height={14} aria-hidden="true" />
              Projects
            </Link>
          </li>
          <li aria-current="page">{name}</li>
        </ol>
      </Reveal>

      <PageHead
        id="project-heading"
        index="03"
        label={`Project ${pad(number)} / ${pad(total)}`}
        title={lead}
        accent={accent}
      >
        <Reveal className="project-page__meta" delay={0.16}>
          <span className="chip">
            <Icon icon="ph:calendar-blank-bold" width={12} height={12} aria-hidden="true" />
            {project.startDate}
          </span>
          <span className="chip">
            <Icon icon="ph:stack-bold" width={12} height={12} aria-hidden="true" />
            {project.technologies.length} technologies
          </span>
          {project.url && (
            <span className="chip project-page__live">
              <span className="project-page__live-dot" aria-hidden="true" />
              Live
            </span>
          )}
        </Reveal>
      </PageHead>

      <Reveal className="project-page__panel glass" y={40}>
        <ProjectBody project={project} number={number} slides={slides} headingLevel={2} />
      </Reveal>

      <nav className="project-pager" aria-label="More projects">
        <Reveal className="project-pager__cell" y={32}>
          <PagerLink neighbour={previous} direction="prev" />
        </Reveal>
        <Reveal className="project-pager__cell" y={32} delay={0.08}>
          <PagerLink neighbour={next} direction="next" />
        </Reveal>
      </nav>

      <Reveal as="div" className="page-nav">
        <Magnet>
          <Link href="/projects" className="btn btn--ghost">
            <Icon icon="ph:squares-four-bold" width={18} height={18} aria-hidden="true" />
            <span>All projects</span>
          </Link>
        </Magnet>
        <Magnet>
          <Link href="/contact" className="btn btn--primary">
            <Icon icon="ph:paper-plane-tilt-bold" width={18} height={18} aria-hidden="true" />
            <span>Work together</span>
            <Icon icon="ph:arrow-right-bold" width={16} height={16} aria-hidden="true" />
          </Link>
        </Magnet>
      </Reveal>
    </article>
  );
}

export default ProjectPage;
