'use client';

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, m } from 'framer-motion';
import { Icon } from '@iconify/react';

import Magnet from 'components/Magnet/Magnet';
import { PageHead } from 'components/PageHead/PageHead';
import { Reveal } from 'components/Motion/Reveal';

import { usePointerGlow } from '@/hooks/usePointerGlow';

import { bentoLayout } from './bento';
import ProjectArt from './ProjectArt/ProjectArt';
import ProjectDetailsModal from './ProjectDetailsModal/ProjectDetailsModal';
import { techIconClass } from './techIcon';

import type { CSSProperties } from 'react';
import type { BentoCell } from './bento';
import type { Project, Projects as ProjectsProps, Technology } from '@/types';

import './Projects.scss';

interface YearFilter {
  id: string;
  label: string;
  test: (year: number) => boolean;
}

const yearOf = (project: Project) => Number.parseInt(project.startDate, 10);

/** "All", the latest year, the two years before it, then everything earlier */
function buildFilters(items: Project[]): YearFilter[] {
  const all: YearFilter = { id: 'all', label: 'All', test: () => true };
  const years = items.map(yearOf).filter(Number.isFinite);
  if (!years.length) return [all];
  const latest = Math.max(...years);
  const filters: YearFilter[] = [
    all,
    { id: 'latest', label: String(latest), test: (y) => y >= latest },
    {
      id: 'recent',
      label: `${latest - 2}–${String(latest - 1).slice(-2)}`,
      test: (y) => y >= latest - 2 && y < latest,
    },
    { id: 'earlier', label: 'Earlier', test: (y) => y < latest - 2 },
  ];
  return filters.filter((f) => f.id === 'all' || years.some(f.test));
}

const snippet = (text: string, max = 120) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, text.lastIndexOf(' ', max));
  return `${cut.replace(/[\s,.;:—–-]+$/, '')}…`;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Up to four tech chips, fewer when the names are long, so chips stay on ~2 rows */
const pickTechs = (technologies: Technology[], budget = 44) => {
  const picked: Technology[] = [];
  let used = 0;
  for (const t of technologies) {
    if (picked.length === 4 || (picked.length > 0 && used + t.name.length > budget)) break;
    picked.push(t);
    used += t.name.length;
  }
  return picked;
};

/** Very wide artwork (logos, banners) is shown whole on a plate instead of cropped */
const isLogo = (size: { width: number; height: number }) => size.width / size.height > 2.2;

const ProjectCard = ({
  project,
  number,
  cell,
  eager,
  onOpen,
}: {
  project: Project;
  number: number;
  cell: BentoCell;
  eager: boolean;
  onOpen: () => void;
}) => {
  const ref = usePointerGlow<HTMLElement>({ tilt: 4 });
  const { title, description, startDate, thumbnail, technologies, url } = project;
  const preview = project.images?.[0];
  const logo = !!preview && isLogo(preview.size);
  const lgWide = cell.lg > 1;
  const mdWide = cell.md > 1;
  const techs = pickTechs(technologies);
  const extra = technologies.length - techs.length;
  const sizes = `(min-width: 1080px) ${lgWide ? 780 : 390}px, (min-width: 640px) ${mdWide ? '100vw' : '50vw'}, 100vw`;

  const classes = [
    'proj-card',
    'glass',
    'spotlight',
    lgWide && 'proj-card--lg-wide',
    mdWide && 'proj-card--md-wide',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Reveal
      as="li"
      className="projects__cell"
      delay={cell.delay}
      y={56}
      scale={0.96}
      style={{ '--span-lg': String(cell.lg), '--span-md': String(cell.md) } as CSSProperties}
    >
      <article className={classes} ref={ref}>
        <div className="proj-card__media" aria-hidden="true">
          <span className="proj-card__frame">
            {preview && !logo ? (
              <Image
                src={preview.url}
                alt=""
                fill
                sizes={sizes}
                className="proj-card__img"
                loading={eager ? 'eager' : 'lazy'}
              />
            ) : (
              <ProjectArt icon={thumbnail} tone={number} showIcon={!preview} />
            )}
          </span>
          <span className="proj-card__scan" />
          <span className="proj-card__sheen" />
          <span className="proj-card__shade" />
          {preview && logo && (
            <span className="proj-card__plate">
              <Image
                src={preview.url}
                alt=""
                fill
                sizes="320px"
                className="proj-card__logo"
                loading={eager ? 'eager' : 'lazy'}
              />
            </span>
          )}
          {url && (
            <span className="proj-card__live">
              <span className="proj-card__live-dot" />
              Live
            </span>
          )}
          {preview && (
            <span className="proj-card__badge">
              <Icon icon={thumbnail || 'ph:code-bold'} width={20} height={20} />
            </span>
          )}
        </div>

        <div className="proj-card__body">
          <div className="proj-card__meta">
            <span className="proj-card__no" aria-hidden="true">
              {`№${pad(number)}`}
            </span>
            <span className="proj-card__rule" aria-hidden="true" />
            <span className="chip proj-card__year">
              <Icon icon="ph:calendar-blank-bold" width={12} height={12} aria-hidden="true" />
              {startDate}
            </span>
          </div>

          <h2 className="proj-card__title">{title.trim()}</h2>
          <p className="proj-card__desc">{snippet(description)}</p>

          <ul className="proj-card__tech" aria-label="Key technologies">
            {techs.map((t) => (
              <li className="chip" key={t.name}>
                <Icon
                  icon={t.class}
                  width={14}
                  height={14}
                  className={techIconClass(t.class)}
                  aria-hidden="true"
                />
                {t.name}
              </li>
            ))}
            {extra > 0 && (
              <li className="chip proj-card__more">
                +{extra}
                <span className="sr-only"> more</span>
              </li>
            )}
          </ul>

          <button
            type="button"
            className="proj-card__btn"
            onClick={onOpen}
            aria-haspopup="dialog"
            aria-label={`View details for ${title.trim()}`}
          >
            <span>View details</span>
            <span className="proj-card__btn-icon" aria-hidden="true">
              <Icon icon="ph:arrow-up-right-bold" width={14} height={14} />
            </span>
          </button>
        </div>
      </article>
    </Reveal>
  );
};

export const Projects = ({ projects }: { projects: ProjectsProps }) => {
  const { label, items } = projects;
  const filters = useMemo(() => buildFilters(items), [items]);
  const [filterId, setFilterId] = useState('all');
  const [selected, setSelected] = useState<number | null>(null);

  const activeIndex = Math.max(
    0,
    filters.findIndex((f) => f.id === filterId)
  );
  const active = filters[activeIndex];
  const visible = useMemo(
    () =>
      items
        .map((project, i) => ({ project, number: i + 1 }))
        .filter(({ project }) => active.test(yearOf(project))),
    [items, active]
  );
  const cells = useMemo(() => bentoLayout(visible.length), [visible.length]);
  const counts = useMemo(
    () => filters.map((f) => items.filter((p) => f.test(yearOf(p))).length),
    [filters, items]
  );

  const close = useCallback(() => setSelected(null), []);
  const selectedProject = selected === null ? null : items[selected];

  return (
    <section className="page projects" aria-labelledby="projects-heading">
      <PageHead
        id="projects-heading"
        index="03"
        label={label}
        title="Selected"
        accent="projects"
        sub="A cross-section of platforms, tools and architectures — from passion projects to enterprise applications shipped in production."
      />

      {filters.length > 1 && (
        <Reveal className="projects__toolbar" y={24}>
          <div
            className="projects__filter"
            role="group"
            aria-label="Filter projects by year"
            style={
              {
                '--count': filters.length,
                '--active': activeIndex,
              } as CSSProperties
            }
          >
            <span className="projects__filter-pill" aria-hidden="true" />
            {filters.map((f, i) => (
              <button
                key={f.id}
                type="button"
                className="projects__filter-btn"
                aria-pressed={f.id === active.id}
                onClick={() => setFilterId(f.id)}
              >
                <span>{f.label}</span>
                <span className="projects__filter-count" aria-hidden="true">
                  {counts[i]}
                </span>
                <span className="sr-only">, {counts[i]} projects</span>
              </button>
            ))}
          </div>
          <p className="projects__status" role="status">
            <span className="projects__status-dot" aria-hidden="true" />
            <span>
              Showing <b>{pad(visible.length)}</b> of {pad(items.length)}
              {active.id === 'all' ? ' projects' : ` · ${active.label}`}
            </span>
          </p>
        </Reveal>
      )}

      <AnimatePresence mode="wait">
        <m.ul
          key={active.id}
          className="projects__grid"
          exit={{
            opacity: 0,
            y: 24,
            filter: 'blur(10px)',
            transition: { duration: 0.3, ease: [0.65, 0, 0.35, 1] },
          }}
        >
          {visible.map(({ project, number }, i) => (
            <ProjectCard
              key={project.title}
              project={project}
              number={number}
              cell={cells[i]}
              eager={i < 3}
              onOpen={() => setSelected(number - 1)}
            />
          ))}
        </m.ul>
      </AnimatePresence>

      <Reveal as="div" className="page-nav">
        <Magnet>
          <Link href="/contact" className="btn btn--primary">
            <Icon icon="ph:paper-plane-tilt-bold" width={18} height={18} aria-hidden="true" />
            <span>Work together</span>
            <Icon icon="ph:arrow-right-bold" width={16} height={16} aria-hidden="true" />
          </Link>
        </Magnet>
        <Magnet>
          <Link href="/skills" className="btn btn--ghost">
            <Icon icon="ph:atom-bold" width={18} height={18} aria-hidden="true" />
            <span>Explore skills</span>
          </Link>
        </Magnet>
      </Reveal>

      <AnimatePresence>
        {selectedProject && selected !== null && (
          <ProjectDetailsModal
            key={selectedProject.title}
            project={selectedProject}
            number={selected + 1}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </section>
  );
};

export default Projects;
