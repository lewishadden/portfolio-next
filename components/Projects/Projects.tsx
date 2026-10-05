'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useLenis } from 'lenis/react';

import Magnet from 'components/Magnet/Magnet';
import { PageHead } from 'components/PageHead/PageHead';
import { Reveal } from 'components/Motion/Reveal';
import { worldStore } from 'components/World/worldStore';

import { projectPath, projectSlugFromPath } from '@/utils/projectPaths';

import ProjectArt from './ProjectArt/ProjectArt';
import ProjectDetailsModal from './ProjectDetailsModal/ProjectDetailsModal';
import { techIconClass } from './techIcon';

import type { CSSProperties, MouseEvent } from 'react';
import type { Project, Projects as ProjectsProps, Technology } from '@/types';

import './Projects.scss';

const snippet = (text: string, max = 190) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, text.lastIndexOf(' ', max));
  return `${cut.replace(/[\s,.;:–-]+$/, '')}…`;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Up to five tech chips, fewer when the names are long, so chips stay on ~2 rows */
const pickTechs = (technologies: Technology[], budget = 52) => {
  const picked: Technology[] = [];
  let used = 0;
  for (const t of technologies) {
    if (picked.length === 5 || (picked.length > 0 && used + t.name.length > budget)) break;
    picked.push(t);
    used += t.name.length;
  }
  return picked;
};

/** Very wide artwork (logos, banners) is shown whole on a plate instead of cropped */
const isLogo = (size: { width: number; height: number }) => size.width / size.height > 2.2;

const siteHost = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** Modified / middle clicks keep their browser behaviour (new tab, etc.) */
const plainClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** The project in front of the helix: its card, swapped as the helix turns */
function ProjectPanel({
  project,
  number,
  total,
  onOpen,
}: {
  project: Project;
  number: number;
  total: number;
  onOpen: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { title, slug, description, startDate, thumbnail, technologies, url } = project;
  const name = title.trim();
  const preview = project.images?.[0];
  const logo = !!preview && isLogo(preview.size);
  const techs = pickTechs(technologies);
  const extra = technologies.length - techs.length;

  return (
    <article className="proj-panel glass" aria-labelledby={`project-${slug}`}>
      {/* Without the 3D world there is no helix: the panel shows the shot itself */}
      <div className="proj-panel__shot" aria-hidden="true">
        {preview && !logo ? (
          <Image
            src={preview.url}
            alt=""
            fill
            sizes="(min-width: 900px) 32rem, 100vw"
            className="proj-panel__img"
          />
        ) : (
          <ProjectArt icon={thumbnail} tone={number} showIcon={!preview} />
        )}
        {preview && logo && (
          <span className="proj-panel__plate">
            <Image src={preview.url} alt="" fill sizes="320px" className="proj-panel__logo" />
          </span>
        )}
      </div>

      <p className="proj-panel__meta">
        <span className="proj-panel__no">
          {pad(number)}
          <span className="proj-panel__of"> / {pad(total)}</span>
        </span>
        <span className="proj-panel__rule" aria-hidden="true" />
        <span className="chip">
          <Icon icon="ph:calendar-blank-bold" width={12} height={12} aria-hidden="true" />
          {startDate}
        </span>
        {url && (
          <span className="chip proj-panel__live">
            <span className="proj-panel__live-dot" aria-hidden="true" />
            Live
          </span>
        )}
      </p>

      <h2 id={`project-${slug}`} className="proj-panel__title">
        {name}
      </h2>
      <p className="proj-panel__desc">{snippet(description)}</p>

      <ul className="proj-panel__tech" aria-label="Key technologies">
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
          <li className="chip proj-panel__more">
            +{extra}
            <span className="sr-only"> more</span>
          </li>
        )}
      </ul>

      <div className="proj-panel__actions">
        {/* A real link (crawlable, opens in a new tab) that opens the modal on a plain click */}
        <Link
          href={projectPath(slug)}
          prefetch={false}
          className="btn btn--primary proj-panel__btn"
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-label={`View details for ${name}`}
        >
          <span>View details</span>
          <Icon icon="ph:arrow-up-right-bold" width={15} height={15} aria-hidden="true" />
        </Link>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="proj-panel__site">
            <Icon icon="ph:globe-hemisphere-west-bold" width={15} height={15} aria-hidden="true" />
            <span>{siteHost(url)}</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
    </article>
  );
}

/**
 * The projects page is the helix itself. Scrolling turns it (a runway of
 * page height per project drives `worldStore.projectFocus`) while a sticky
 * panel shows the project in front and an index links to every project.
 * Without the 3D world the runway collapses: the index picks the project
 * and the panel shows its own screenshot.
 */
export const Projects = ({ projects }: { projects: ProjectsProps }) => {
  const { label, items } = projects;
  const tourRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const lenis = useLenis();

  // The open project lives in the URL: opening one pushes /projects/<slug>
  // without a navigation (the page stays mounted underneath), so the address
  // is shareable, refresh lands on the full project page and Back closes it.
  const openSlug = projectSlugFromPath(usePathname());
  const selected = openSlug ? items.findIndex((p) => p.slug === openSlug) : -1;

  /** Scroll runway: where it starts and how much scroll each project takes (0 without the world) */
  const runway = useCallback(() => {
    const tour = tourRef.current;
    const stage = stageRef.current;
    if (!tour || !stage) return { top: 0, step: 0 };
    return {
      top: tour.getBoundingClientRect().top + window.scrollY,
      step: (tour.offsetHeight - stage.offsetHeight) / Math.max(1, items.length - 1),
    };
  }, [items.length]);

  // Scroll position → the project in front of the helix
  useEffect(() => {
    const tour = tourRef.current;
    if (!tour) return;
    let lane = runway();
    let frame = 0;
    const update = () => {
      frame = 0;
      if (lane.step < 10) return;
      const focus = Math.min(
        Math.max((window.scrollY - lane.top) / lane.step, 0),
        items.length - 1
      );
      worldStore.projectFocus = focus;
      setActive(Math.round(focus));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(() => {
      lane = runway();
      schedule();
    });
    update();
    resize.observe(tour);
    resize.observe(document.body);
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      worldStore.projectFocus = -1;
    };
  }, [items.length, runway]);

  const goTo = useCallback(
    (index: number) => {
      const lane = runway();
      if (lane.step < 10) {
        setActive(index);
        return;
      }
      const y = lane.top + lane.step * index;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (lenis) lenis.scrollTo(y, { immediate: reduce });
      else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    },
    [lenis, runway]
  );

  const open = useCallback((e: MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (!plainClick(e)) return;
    e.preventDefault();
    window.history.pushState({ projectModal: true }, '', projectPath(slug));
  }, []);

  const close = useCallback(() => {
    if (window.history.state?.projectModal) window.history.back();
    else window.history.replaceState(null, '', '/projects');
  }, []);

  const current = items[Math.min(active, items.length - 1)];
  const selectedProject = selected >= 0 ? items[selected] : null;

  return (
    <section className="page projects" aria-labelledby="projects-heading">
      <PageHead
        id="projects-heading"
        index="03"
        label={label}
        title="Selected"
        accent="projects"
        sub="A cross-section of platforms, tools and architectures, from passion projects to enterprise applications shipped in production."
      >
        <p className="projects__hint">
          <Icon icon="ph:mouse-scroll-bold" width={16} height={16} aria-hidden="true" />
          <span>Scroll to turn the helix · {pad(items.length)} projects</span>
        </p>
      </PageHead>

      <div
        ref={tourRef}
        className="projects__tour"
        style={{ '--steps': items.length } as CSSProperties}
      >
        <div ref={stageRef} className="projects__stage">
          <nav className="projects__index" aria-label="Projects">
            <ol>
              {items.map((project, i) => (
                <li key={project.slug}>
                  <Link
                    href={projectPath(project.slug)}
                    prefetch={false}
                    className="projects__index-link"
                    aria-current={i === active ? 'true' : undefined}
                    onClick={(e) => {
                      if (!plainClick(e)) return;
                      e.preventDefault();
                      goTo(i);
                    }}
                  >
                    <span aria-hidden="true">{pad(i + 1)}</span>
                    <span className="sr-only">{project.title.trim()}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          {current && (
            <ProjectPanel
              key={current.slug}
              project={current}
              number={items.indexOf(current) + 1}
              total={items.length}
              onOpen={(e) => open(e, current.slug)}
            />
          )}
        </div>
      </div>

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
        {selectedProject && (
          <ProjectDetailsModal
            key={selectedProject.slug}
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
