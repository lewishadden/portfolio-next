'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { m, usePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useLenis } from 'lenis/react';

import { ScrambleText } from 'components/Motion/ScrambleText';
import { screenSlide } from 'components/World/ride';
import { setChrome, worldStore } from 'components/World/worldStore';
import { ProjectBody, pad, useSlides } from '../ProjectBody/ProjectBody';

import { useFocusTrap } from '@/hooks/useFocusTrap';
import { motionLevel } from '@/utils/motion';

import type { KeyboardEvent } from 'react';
import type Lenis from 'lenis';
import type { Project } from '@/types';

import './ProjectDetailsModal.scss';

const ease = [0.16, 1, 0.3, 1] as const;
const easeIn = [0.65, 0, 0.35, 1] as const;

/** Where the dialog is a full-screen sheet (the SCSS's phone breakpoint): it covers the world */
const sheetQuery = '(max-width: 640px)';

/** How long (ms) the gallery takes to fly out of the 3D screen into its place, and back */
const flipIn = 700;
const flipOut = 420;

type Box = { left: number; top: number; right: number; bottom: number };

/**
 * The 3D screen the gallery can fly out of (worldStore.screenRect): only
 * with the world on and full motion, and a screen big enough to read as one
 */
function screenOrigin(): Box | null {
  const { left, top, right, bottom, on } = worldStore.screenRect;
  if (!on || document.documentElement.dataset.world !== 'on' || motionLevel() !== 'full') {
    return null;
  }
  return right - left >= 48 && bottom - top >= 30 ? { left, top, right, bottom } : null;
}

/** Puts the page's title back, if the dialog's is still the one shown */
function restoreTitle(titled: { current: { previous: string; shown: string } | null }) {
  const title = titled.current;
  titled.current = null;
  if (title && document.title === title.shown) document.title = title.previous;
}

/** The transform (origin top left) that lays an element whose box is `from` over `to` */
function flipTransform(from: DOMRect, to: Box) {
  const scaleX = (to.right - to.left) / Math.max(from.width, 1);
  const scaleY = (to.bottom - to.top) / Math.max(from.height, 1);
  return `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scaleX}, ${scaleY})`;
}

/* Page scroll lock shared by every open dialog (one may still be exiting as another opens) */
let scrollLocks = 0;
let lockedY = 0;

// overflow: hidden stops the visitor scrolling, but not programmatic scrolls
// (find-in-page, assistive tech, scrollIntoView) — put the page straight back
const holdScroll = () => {
  if (window.scrollY !== lockedY) window.scrollTo({ top: lockedY, behavior: 'instant' });
};

function lockScroll(lenis: Lenis | undefined) {
  scrollLocks += 1;
  if (scrollLocks > 1) return;
  lockedY = window.scrollY;
  const root = document.documentElement;
  root.style.overflow = 'hidden';
  root.style.scrollbarGutter = 'stable';
  lenis?.stop();
  window.addEventListener('scroll', holdScroll);
}

function unlockScroll(lenis: Lenis | undefined) {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks > 0) return;
  window.removeEventListener('scroll', holdScroll);
  const root = document.documentElement;
  root.style.overflow = '';
  root.style.scrollbarGutter = '';
  lenis?.start();
}

export function ProjectDetailsModal({
  project,
  number,
  fromScreen = false,
  documentTitle,
  onClose,
}: {
  project: Project;
  /** 1-based position in the full project list, shown as "№03" */
  number: number;
  /** The project's 3D screen is the one in front: the gallery flies out of it */
  fromScreen?: boolean;
  /** The document's title while it is open (the project page's: "Drive King | Projects | …") */
  documentTitle?: string;
  onClose: () => void;
}) {
  const { title, images, url, startDate, thumbnail } = project;
  const name = title.trim();
  // Opens on the shot the project's screen is showing
  const slides = useSlides(images.length, () => screenSlide(number - 1, images.length));
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  const lenis = useLenis();
  const titleId = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const [isPresent, safeToRemove] = usePresence();

  // Where the gallery flies in from: the 3D screen in front, as it opens.
  // Otherwise (no world, reduced motion, opened another way) the dialog
  // rises in as before
  const [origin] = useState(() => (fromScreen ? screenOrigin() : null));
  const flip = origin !== null;

  // FLIP: the stage is laid out in its place, then drawn over the screen and
  // eased back into place (from the same frame it was measured in), ending
  // with no transform at all
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!origin || !stage) return;
    const from = stage.getBoundingClientRect();
    stage.animate(
      [
        { transformOrigin: '0 0', transform: flipTransform(from, origin) },
        { transformOrigin: '0 0', transform: 'none' },
      ],
      { duration: flipIn, easing: `cubic-bezier(${ease.join(', ')})` }
    );
  }, [origin]);

  // Closing: the world draws again, and a gallery that flew in flies back
  // into its screen (if it is still on screen) before the dialog goes
  const closing = useRef(false);
  useEffect(() => {
    if (isPresent || closing.current) return;
    closing.current = true;
    setChrome({ modalCover: false });
    const stage = stageRef.current;
    const target = flip ? screenOrigin() : null;
    const from = stage?.getBoundingClientRect();
    if (!stage || !target || !from || from.bottom < 0 || from.top > window.innerHeight) {
      safeToRemove?.();
      return;
    }
    const back = stage.animate(
      [
        { transformOrigin: '0 0', transform: 'none' },
        { transformOrigin: '0 0', transform: flipTransform(from, target) },
      ],
      { duration: flipOut, easing: `cubic-bezier(${easeIn.join(', ')})`, fill: 'forwards' }
    );
    back.finished.then(
      () => safeToRemove?.(),
      () => safeToRemove?.()
    );
  }, [isPresent, flip, safeToRemove]);

  // The tab says which project is open, as the project's own page would;
  // the page's title comes back as it closes (unless something has changed
  // it since, such as a navigation)
  const titled = useRef<{ previous: string; shown: string } | null>(null);
  useEffect(() => {
    if (!documentTitle) return;
    titled.current = { previous: document.title, shown: documentTitle };
    document.title = documentTitle;
    return () => restoreTitle(titled);
  }, [documentTitle]);
  useEffect(() => {
    if (!isPresent) restoreTitle(titled);
  }, [isPresent]);

  // On a phone the dialog is a full-screen sheet: the world behind it stops
  // drawing while it is open
  useEffect(() => {
    const sheet = window.matchMedia(sheetQuery);
    const cover = () => setChrome({ modalCover: sheet.matches && !closing.current });
    cover();
    sheet.addEventListener('change', cover);
    return () => {
      sheet.removeEventListener('change', cover);
      setChrome({ modalCover: false });
    };
  }, []);

  // Move focus into the dialog; the focus trap hands it back to the card on close
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, [dialogRef]);

  // Freeze the page (native + Lenis smooth scroll) behind the dialog
  useEffect(() => {
    lockScroll(lenis);
    return () => unlockScroll(lenis);
  }, [lenis]);

  // Escape closes from anywhere
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Left / right arrows flip through the screenshots from anywhere in the dialog
  // (the gallery handles them itself when it has focus)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      slides.step(e.key === 'ArrowRight' ? 1 : -1);
    }
  };

  return createPortal(
    <div className={`pdm${flip ? ' pdm--flip' : ''}${flip && !isPresent ? ' pdm--closing' : ''}`}>
      <m.div
        className="pdm__backdrop"
        aria-hidden="true"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.35, ease: easeIn } }}
        transition={{ duration: 0.45, ease }}
      />

      <m.div
        ref={dialogRef}
        className="pdm__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        // Flying out of the screen, the dialog itself doesn't move (its
        // frame and copy fade in round the gallery: .pdm--flip)
        initial={flip ? false : { opacity: 0, y: 48, scale: 0.92, filter: 'blur(16px)' }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          transitionEnd: { filter: 'none' },
        }}
        exit={
          flip
            ? { opacity: 0, transition: { delay: flipOut / 1000 - 0.08, duration: 0.12 } }
            : {
                opacity: 0,
                y: 28,
                scale: 0.96,
                filter: 'blur(10px)',
                transition: { duration: 0.3, ease: easeIn },
              }
        }
        transition={{ duration: 0.75, ease }}
      >
        <span className="pdm__border" aria-hidden="true" />

        <header className="pdm__head">
          <span className="pdm__badge" aria-hidden="true">
            <Icon icon={thumbnail || 'ph:code-bold'} width={22} height={22} />
          </span>
          <div className="pdm__heading">
            <p className="pdm__eyebrow">
              <span aria-hidden="true">{`№${pad(number)}`}</span>
              <span className="pdm__eyebrow-sep" aria-hidden="true" />
              <span>{startDate}</span>
              {url && (
                <span className="pdm__live">
                  <span className="pdm__live-dot" aria-hidden="true" />
                  Live
                </span>
              )}
            </p>
            <h2 id={titleId} className="pdm__title">
              <ScrambleText text={name} trigger="mount" delay={180} duration={650} />
            </h2>
          </div>
          <button
            type="button"
            className="pdm__close"
            onClick={onClose}
            aria-label="Close project details"
          >
            <Icon icon="ph:x-bold" width={20} height={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pdm__body" data-lenis-prevent>
          <ProjectBody
            project={project}
            number={number}
            slides={slides}
            headingLevel={3}
            stageRef={stageRef}
          />
        </div>
      </m.div>
    </div>,
    document.body
  );
}

export default ProjectDetailsModal;
