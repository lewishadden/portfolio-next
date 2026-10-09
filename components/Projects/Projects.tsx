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
import { projectRideEvent, settleFocus } from 'components/World/ride';
import { emitCue, worldStore } from 'components/World/worldStore';

import { motionLevel } from '@/utils/motion';
import { projectPath, projectSlugFromPath, projectTitle } from '@/utils/projectPaths';

import ProjectArt from './ProjectArt/ProjectArt';
import ProjectDetailsModal from './ProjectDetailsModal/ProjectDetailsModal';
import { techIconClass } from './techIcon';

import type { CSSProperties, MouseEvent } from 'react';
import type { Project, Projects as ProjectsProps, Technology } from '@/types';

import './Projects.scss';

const snippet = (text: string, max = 170) => {
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

/**
 * The project in front of the camera, written around its screen: number and
 * title above left, stack above right, summary and actions below. The
 * middle is left to the 3D screen (or, without the world, the shot itself).
 */
function ProjectHud({
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
    <article className="proj-hud" aria-labelledby={`project-${slug}`}>
      <header className="proj-hud__head">
        <p className="proj-hud__meta">
          <span className="proj-hud__no">
            {pad(number)}
            <span className="proj-hud__of"> / {pad(total)}</span>
          </span>
          <span className="proj-hud__rule" aria-hidden="true" />
          <span className="chip">
            <Icon icon="ph:calendar-blank-bold" width={12} height={12} aria-hidden="true" />
            {startDate}
          </span>
          {url && (
            <span className="chip proj-hud__live">
              <span className="proj-hud__live-dot" aria-hidden="true" />
              Live
            </span>
          )}
        </p>
        <h2 id={`project-${slug}`} className="proj-hud__title">
          {name}
        </h2>
      </header>

      <ul className="proj-hud__tech" aria-label="Key technologies">
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
          <li className="chip proj-hud__more">
            +{extra}
            <span className="sr-only"> more</span>
          </li>
        )}
      </ul>

      {/* The 3D screen shows through here; without the world, the shot itself */}
      <div className="proj-hud__screen" aria-hidden="true">
        <div className="proj-hud__shot">
          {preview && !logo ? (
            <Image
              src={preview.url}
              alt=""
              fill
              sizes="(min-width: 900px) 56vw, 100vw"
              className="proj-hud__img"
            />
          ) : (
            <ProjectArt icon={thumbnail} tone={number} showIcon={!preview} />
          )}
          {preview && logo && (
            <span className="proj-hud__plate">
              <Image src={preview.url} alt="" fill sizes="320px" className="proj-hud__logo" />
            </span>
          )}
        </div>
      </div>

      <p className="proj-hud__desc">{snippet(description)}</p>

      <div className="proj-hud__actions">
        {/* A real link (crawlable, opens in a new tab) that opens the modal on a plain click */}
        <Link
          href={projectPath(slug)}
          prefetch={false}
          className="btn btn--primary proj-hud__btn"
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-label={`View details for ${name}`}
        >
          <span>View details</span>
          <Icon icon="ph:arrow-up-right-bold" width={15} height={15} aria-hidden="true" />
        </Link>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="proj-hud__site">
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
 * The HUD's copy travels with the camera between projects: `--ride` is how
 * far the camera is from the project shown (settleFocus, -0.5..0.5, 0 while
 * it holds on one) and `--hud-o` the copy's opacity, gone by a ride of
 * 0.45, where the next project's copy takes over. Within `rideRest` of a
 * project there is no transform or opacity at all, so text at rest is crisp
 */
const rideRest = 0.02;

function rideStage(stage: HTMLElement | null, focus: number) {
  if (!stage) return;
  const ride = settleFocus(focus) - Math.round(focus);
  if (Math.abs(ride) < rideRest) {
    stage.removeAttribute('data-riding');
    stage.style.removeProperty('--ride');
    stage.style.removeProperty('--hud-o');
    return;
  }
  stage.setAttribute('data-riding', '');
  stage.style.setProperty('--ride', ride.toFixed(4));
  stage.style.setProperty('--hud-o', Math.min(Math.max(1 - Math.abs(ride) * 2.2, 0), 1).toFixed(3));
}

/** Scroll that comes to rest on the ride glides to a stop, after this long (ms) */
const snapAfter = 160;
/**
 * A scroll that ends this far (px) from where the last one came to rest
 * carries on to the next stop its way, however short of halfway it is
 * (the stop beyond its start nearest where it ended); a smaller one goes
 * back. From the top of the page a smaller one still docks
 */
const snapCommit = 60;
const snapCommitTop = 24;
const snapEase = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The projects page is a ride down the helix. A runway of scroll (one step
 * per project, starting where the sticky stage docks under the header)
 * drives `worldStore.projectFocus`; the camera descends the spiral to face
 * each screen, centred and large, while the stage writes that project's
 * details around it and an index links to every project. Scroll that comes
 * to rest on the ride snaps to the nearest project (or back to the top),
 * and the first project's details stay hidden until its stage docks. Past
 * the last project the camera descends with the page. Without
 * the 3D world the ride is the same, but the stage shows each project's own
 * screenshot where the 3D screen would be, and nothing waits.
 */
export const Projects = ({
  projects,
  siteName,
}: {
  projects: ProjectsProps;
  /** The site's name, for the document title while a project's modal is open */
  siteName: string;
}) => {
  const { label, items } = projects;
  const tourRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const lenis = useLenis();

  // The open project lives in the URL: opening one pushes /projects/<slug>
  // without a navigation (the page stays mounted underneath), so the address
  // is shareable, refresh lands on the full project page and Back closes it.
  const openSlug = projectSlugFromPath(usePathname());
  const selected = openSlug ? items.findIndex((p) => p.slug === openSlug) : -1;

  /**
   * Scroll runway: the scroll at which the stage docks under the header,
   * where the ride starts, and how much scroll each project takes (0 when
   * there's nothing to ride). Project i is in front at docked + step * i
   */
  const runway = useCallback(() => {
    const tour = tourRef.current;
    const stage = stageRef.current;
    if (!tour || !stage) return { docked: 0, step: 0 };
    const top = tour.getBoundingClientRect().top + window.scrollY;
    return {
      docked: top - (parseFloat(getComputedStyle(stage).top) || 0),
      step: (tour.offsetHeight - stage.offsetHeight) / Math.max(1, items.length - 1),
    };
  }, [items.length]);

  // Scroll position → the project the camera faces (an open project wins)
  useEffect(() => {
    const tour = tourRef.current;
    if (!tour) return;
    let lane = runway();
    let frame = 0;
    /** The project the ride last settled on (-1 off the ride); the first update only notes it */
    let ticked = -1;
    let quiet = true;
    const update = () => {
      frame = 0;
      const stage = stageRef.current;
      if (selected >= 0) {
        worldStore.projectFocus = selected;
        worldStore.projectIntro = 0;
        worldStore.projectTail = 0;
        rideStage(stage, selected);
        return;
      }
      if (lane.step < 10) {
        stage?.removeAttribute('data-waiting');
        rideStage(stage, 0);
        return;
      }
      const focus = Math.min(
        Math.max((window.scrollY - lane.docked) / lane.step, 0),
        items.length - 1
      );
      worldStore.projectFocus = focus;
      rideStage(stage, focus);
      // Past the last project the camera descends with the page, so the last
      // screen scrolls away with its copy
      const last = lane.docked + lane.step * (items.length - 1);
      worldStore.projectTail = Math.max(window.scrollY - last, 0) / window.innerHeight;
      // The first screen comes forward as the stage docks, not under the page
      // head, and its details wait for it
      const intro =
        lane.docked > 1 ? Math.min(Math.max(1 - window.scrollY / lane.docked, 0), 1) : 0;
      worldStore.projectIntro = intro;
      stage?.toggleAttribute('data-waiting', intro > 0.12);
      // The ride's detent: settling on another project ticks (not as the
      // page first draws, nor as the modal closes). With the world on, the
      // helix's station ticks from the screen instead
      const rest = Math.round(focus);
      if (intro > 0.12) ticked = -1;
      else if (rest !== ticked && Math.abs(settleFocus(focus) - rest) < rideRest) {
        if (!quiet && document.documentElement.dataset.world !== 'on') emitCue('tick');
        ticked = rest;
      }
      quiet = false;
      // Docked: the sticky stage holds the screen, from the first project to the last
      stage?.toggleAttribute(
        'data-docked',
        window.scrollY >= lane.docked - 1 && window.scrollY <= last + 1
      );
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
      worldStore.projectIntro = 0;
      worldStore.projectTail = 0;
    };
  }, [items.length, runway, selected]);

  const goTo = useCallback(
    (index: number) => {
      const lane = runway();
      if (lane.step < 10) {
        setActive(index);
        return;
      }
      const y = lane.docked + lane.step * index;
      const reduce = motionLevel() !== 'full';
      if (lenis) lenis.scrollTo(y, { immediate: reduce, userData: { rideTo: y } });
      else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    },
    [lenis, runway]
  );

  // Snapping: once scroll comes to rest on the ride, glide to a project (or
  // back to the top of the page): the next one in the direction of the
  // gesture once it has gone snapCommit from where it started (the first
  // from the top always docks), else back to the nearest. Past the last
  // project it is free. Any scroll input interrupts the ride's own scrolls
  // (a snap glide, or goTo's ride to a project, marked by their userData)
  useEffect(() => {
    if (!lenis || selected >= 0) return;
    let timer = 0;
    let pressed = false;
    /** Where the scroll last came to rest (or was sent, or a gesture caught one of the ride's scrolls) */
    let anchor = window.scrollY;
    /** Where the scroll a gesture caught was going, when the gesture went the same way (else NaN) */
    let heading = NaN;
    /** Where the ride's own scroll under way is going, if one is (and nothing has taken it over) */
    const riding = () => {
      const to: unknown = lenis.isScrolling === 'smooth' ? lenis.userData.rideTo : undefined;
      return typeof to === 'number' ? to : undefined;
    };
    // Wheel or touch input during one of the ride's scrolls stops it
    // (touch) or carries on from where it has got to (wheel), so the
    // gesture starts there: measured from where the scroll started or was
    // going, a short swipe read as one the other way and the ride went back
    const interrupt = ({ deltaY, event }: { deltaY: number; event: WheelEvent | TouchEvent }) => {
      const to = riding();
      if (to === undefined || deltaY === 0 || event.ctrlKey) return;
      anchor = window.scrollY;
      heading = Math.sign(to - anchor) === Math.sign(deltaY) ? to : NaN;
    };
    const settle = () => {
      const lane = runway();
      if (pressed || lane.step < 10) return;
      // Still gliding (slow frames can space scroll events out): wait for rest
      if (lenis.isScrolling) {
        rest();
        return;
      }
      const at = window.scrollY;
      const caught = heading;
      heading = NaN;
      const stops = items.map((_, i) => lane.docked + lane.step * i);
      const last = stops[stops.length - 1];
      if (at > last + lane.step / 2) {
        anchor = at;
        return;
      }
      if (lane.docked > 1) stops.unshift(0);
      // A gesture that caught a scroll and kept going its way is measured
      // from where that scroll was going, and short of there it goes there:
      // each swipe onwards counts, however soon after the last it comes
      let from = anchor;
      let y = at;
      const way = Math.sign(caught - anchor);
      if (way && Math.sign(y - anchor) === way) {
        from = caught;
        if ((y - caught) * way < 0) y = caught;
      }
      const moved = y - from;
      const commit = from < lane.docked - 2 && moved > 0 ? snapCommitTop : snapCommit;
      // Gone far enough: the nearest stop beyond where it started, its way
      // (not the first past where it stopped: a ride to a project that
      // lands a little past it, as the layout settles, stays there)
      const onward =
        Math.abs(moved) > commit
          ? stops.filter((stop) => (moved > 0 ? stop > from + 2 : stop < from - 2))
          : [];
      const target = (onward.length ? onward : stops).reduce((best, stop) =>
        Math.abs(stop - y) < Math.abs(best - y) ? stop : best
      );
      anchor = target;
      if (Math.abs(target - at) < 2) return;
      lenis.scrollTo(target, {
        duration: 0.75,
        easing: snapEase,
        immediate: motionLevel() !== 'full',
        userData: { rideTo: target },
      });
    };
    function rest() {
      // One of the ride's own scrolls is under way, so no gesture has taken
      // it over: a later ride (an index link, a helix screen) or the one a
      // gesture failed to catch. A heading from an earlier catch is stale
      // (it sent a later ride on past the project chosen, to where the
      // caught one was going). A wheel that catches a ride replaces its
      // userData, and a touch turns the scroll native, so they keep theirs
      if (riding() !== undefined) heading = NaN;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, snapAfter);
    }
    // Dragging the scrollbar (or a finger still down) is not at rest. A
    // scrollbar drag puts the page where it is dropped, so a mouse press
    // drops the heading (a finger keeps it: a second swipe onwards in a
    // caught ride's momentum still counts from where the ride was going)
    const press = (event: PointerEvent) => {
      pressed = true;
      if (event.pointerType === 'mouse') heading = NaN;
    };
    const release = () => {
      pressed = false;
      rest();
    };
    lenis.on('scroll', rest);
    lenis.on('virtual-scroll', interrupt);
    window.addEventListener('pointerdown', press);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.clearTimeout(timer);
      lenis.off('scroll', rest);
      lenis.off('virtual-scroll', interrupt);
      window.removeEventListener('pointerdown', press);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [items, lenis, runway, selected]);

  // A click on a helix screen other than the one in front rides to it
  useEffect(() => {
    const ride = (e: Event) => {
      const index = (e as CustomEvent<number>).detail;
      if (Number.isInteger(index) && index >= 0 && index < items.length) goTo(index);
    };
    window.addEventListener(projectRideEvent, ride);
    return () => window.removeEventListener(projectRideEvent, ride);
  }, [goTo, items.length]);

  // Closing a project's modal leaves the visitor at that project: the ride
  // comes to it if it wasn't the one in front (opened from its screen, or
  // by going forward in history), and its "View details" link gets focus
  const closed = useRef(-1);
  const focusOn = useRef(-1);
  const lastSelected = useRef(selected);
  useEffect(() => {
    if (selected < 0 && lastSelected.current >= 0) closed.current = lastSelected.current;
    lastSelected.current = selected;
  }, [selected]);
  const focusDetails = useCallback(() => {
    stageRef.current?.querySelector<HTMLElement>('.proj-hud__btn')?.focus({ preventScroll: true });
  }, []);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
    if (focusOn.current !== active) return;
    focusOn.current = -1;
    focusDetails();
  }, [active, focusDetails]);
  // Once the dialog has gone (and given the page its scroll back)
  const afterClose = useCallback(() => {
    const index = closed.current;
    closed.current = -1;
    if (index < 0) return;
    requestAnimationFrame(() => {
      if (index === activeRef.current) {
        if (!stageRef.current?.contains(document.activeElement)) focusDetails();
        return;
      }
      // Its link takes focus as the ride gets there (not if the visitor
      // has gone elsewhere and comes by much later)
      focusOn.current = index;
      window.setTimeout(() => {
        if (focusOn.current === index) focusOn.current = -1;
      }, 4000);
      goTo(index);
    });
  }, [focusDetails, goTo]);

  const open = useCallback((e: MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (!plainClick(e)) return;
    e.preventDefault();
    window.history.pushState({ projectModal: true }, '', projectPath(slug));
  }, []);

  const close = useCallback(() => {
    if (window.history.state?.projectModal) window.history.back();
    else window.history.replaceState(null, '', '/projects');
  }, []);

  // Narrow layouts show the index as one row that scrolls sideways: keep
  // the project in front in view
  useEffect(() => {
    const list = indexRef.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (!list || !item || list.scrollWidth <= list.clientWidth) return;
    const left = item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2;
    list.scrollTo({
      left: Math.max(0, left),
      behavior: motionLevel() === 'full' ? 'smooth' : 'auto',
    });
  }, [active]);

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
          <span>
            <span className="projects__hint-ride">Scroll to ride the helix</span>
            <span className="projects__hint-plain">Scroll to browse</span> · {pad(items.length)}{' '}
            projects
          </span>
        </p>
      </PageHead>

      <div
        ref={tourRef}
        className="projects__tour"
        style={{ '--steps': items.length } as CSSProperties}
      >
        <div ref={stageRef} className="projects__stage">
          <nav className="projects__index" aria-label="Projects">
            {/* In narrow layouts a row that scrolls sideways: sideways swipes
                scroll it natively (Lenis took any with a little vertical
                drift for the page), vertical ones still ride the page */}
            <ol ref={indexRef} data-lenis-prevent-horizontal>
              {items.map((project, i) => (
                <li key={project.slug}>
                  <Link
                    href={projectPath(project.slug)}
                    prefetch={false}
                    className="projects__index-link"
                    data-world-project={i}
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
            <ProjectHud
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

      <AnimatePresence onExitComplete={afterClose}>
        {selectedProject && (
          <ProjectDetailsModal
            key={selectedProject.slug}
            project={selectedProject}
            number={selected + 1}
            fromScreen={selected === active}
            documentTitle={`${projectTitle(selectedProject.title)} | ${siteName}`}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </section>
  );
};

export default Projects;
