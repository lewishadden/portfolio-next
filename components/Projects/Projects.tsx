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

import type { MouseEvent } from 'react';
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

/**
 * Which step the middle of the viewport is on, as a fractional index: 2.5 is
 * halfway from the third step's centre to the fourth's
 */
function focusAt(centres: number[], line: number) {
  if (!centres.length) return 0;
  if (line <= centres[0]) return 0;
  const last = centres.length - 1;
  if (line >= centres[last]) return last;
  let i = 0;
  while (centres[i + 1] < line) i++;
  return i + (line - centres[i]) / (centres[i + 1] - centres[i]);
}

function ProjectStep({
  project,
  number,
  total,
  active,
  onOpen,
}: {
  project: Project;
  number: number;
  total: number;
  active: boolean;
  onOpen: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { title, slug, description, startDate, thumbnail, technologies, url } = project;
  const name = title.trim();
  const preview = project.images?.[0];
  const logo = !!preview && isLogo(preview.size);
  const techs = pickTechs(technologies);
  const extra = technologies.length - techs.length;

  return (
    <li className={active ? 'proj-step proj-step--active' : 'proj-step'} data-step={number - 1}>
      <article className="proj-step__card glass" aria-labelledby={`project-${slug}`}>
        {/* Without the 3D world there is no helix: each step shows its own shot */}
        <div className="proj-step__shot" aria-hidden="true">
          {preview && !logo ? (
            <Image
              src={preview.url}
              alt=""
              fill
              sizes="(min-width: 900px) 34rem, 100vw"
              className="proj-step__img"
            />
          ) : (
            <ProjectArt icon={thumbnail} tone={number} showIcon={!preview} />
          )}
          {preview && logo && (
            <span className="proj-step__plate">
              <Image src={preview.url} alt="" fill sizes="320px" className="proj-step__logo" />
            </span>
          )}
        </div>

        <p className="proj-step__meta">
          <span className="proj-step__no">
            {pad(number)}
            <span className="proj-step__of"> / {pad(total)}</span>
          </span>
          <span className="proj-step__rule" aria-hidden="true" />
          <span className="chip">
            <Icon icon="ph:calendar-blank-bold" width={12} height={12} aria-hidden="true" />
            {startDate}
          </span>
          {url && (
            <span className="chip proj-step__live">
              <span className="proj-step__live-dot" aria-hidden="true" />
              Live
            </span>
          )}
        </p>

        <h2 id={`project-${slug}`} className="proj-step__title">
          {name}
        </h2>
        <p className="proj-step__desc">{snippet(description)}</p>

        <ul className="proj-step__tech" aria-label="Key technologies">
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
            <li className="chip proj-step__more">
              +{extra}
              <span className="sr-only"> more</span>
            </li>
          )}
        </ul>

        <div className="proj-step__actions">
          {/* A real link (crawlable, opens in a new tab) that opens the modal on a plain click */}
          <Link
            href={projectPath(slug)}
            prefetch={false}
            className="btn btn--primary proj-step__btn"
            onClick={onOpen}
            aria-haspopup="dialog"
            aria-label={`View details for ${name}`}
          >
            <span>View details</span>
            <Icon icon="ph:arrow-up-right-bold" width={15} height={15} aria-hidden="true" />
          </Link>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="proj-step__site">
              <Icon
                icon="ph:globe-hemisphere-west-bold"
                width={15}
                height={15}
                aria-hidden="true"
              />
              <span>{siteHost(url)}</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      </article>
    </li>
  );
}

/**
 * The projects page is a walk round the helix: every project is a step, and
 * as the page scrolls the 3D helix turns that project's screen to the front
 * (worldStore.projectFocus). Without the 3D world the same steps show their
 * own screenshots, so the page reads as a plain list.
 */
export const Projects = ({ projects }: { projects: ProjectsProps }) => {
  const { label, items } = projects;
  const stepsRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const lenis = useLenis();

  // The open project lives in the URL: opening one pushes /projects/<slug>
  // without a navigation (the steps stay mounted underneath), so the address
  // is shareable, refresh lands on the full project page and Back closes it.
  const openSlug = projectSlugFromPath(usePathname());
  const selected = openSlug ? items.findIndex((p) => p.slug === openSlug) : -1;

  // Scroll position → the project in front of the helix
  useEffect(() => {
    const list = stepsRef.current;
    if (!list) return;
    let centres: number[] = [];
    let frame = 0;
    const measure = () => {
      centres = Array.from(list.children, (step) => {
        const rect = step.getBoundingClientRect();
        return rect.top + window.scrollY + rect.height / 2;
      });
    };
    const update = () => {
      frame = 0;
      const focus = focusAt(centres, window.scrollY + window.innerHeight / 2);
      worldStore.projectFocus = focus;
      setActive(Math.round(focus));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(() => {
      measure();
      schedule();
    });
    measure();
    update();
    resize.observe(list);
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      worldStore.projectFocus = -1;
    };
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const step = stepsRef.current?.children[index] as HTMLElement | undefined;
      if (!step) return;
      const offset = -(window.innerHeight - step.offsetHeight) / 2;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (lenis) lenis.scrollTo(step, { offset, immediate: reduce });
      else step.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    },
    [lenis]
  );

  const open = useCallback((e: MouseEvent<HTMLAnchorElement>, slug: string) => {
    // Modified / middle clicks keep their browser behaviour (new tab, etc.)
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.history.pushState({ projectModal: true }, '', projectPath(slug));
  }, []);

  const close = useCallback(() => {
    if (window.history.state?.projectModal) window.history.back();
    else window.history.replaceState(null, '', '/projects');
  }, []);

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

      <div className="projects__tour">
        <nav className="projects__index" aria-label="Jump to a project">
          <ol>
            {items.map((project, i) => (
              <li key={project.slug}>
                <button
                  type="button"
                  className="projects__index-btn"
                  aria-current={i === active ? 'true' : undefined}
                  onClick={() => goTo(i)}
                >
                  <span aria-hidden="true">{pad(i + 1)}</span>
                  <span className="sr-only">{project.title.trim()}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <ol ref={stepsRef} className="projects__steps">
          {items.map((project, i) => (
            <ProjectStep
              key={project.slug}
              project={project}
              number={i + 1}
              total={items.length}
              active={i === active}
              onOpen={(e) => open(e, project.slug)}
            />
          ))}
        </ol>
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
