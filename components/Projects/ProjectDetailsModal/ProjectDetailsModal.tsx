'use client';

import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { m } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useLenis } from 'lenis/react';

import { ScrambleText } from 'components/Motion/ScrambleText';
import { ProjectBody, pad, useSlides } from '../ProjectBody/ProjectBody';

import { useFocusTrap } from '@/hooks/useFocusTrap';

import type { KeyboardEvent } from 'react';
import type Lenis from 'lenis';
import type { Project } from '@/types';

import './ProjectDetailsModal.scss';

const ease = [0.16, 1, 0.3, 1] as const;
const easeIn = [0.65, 0, 0.35, 1] as const;

/* Page scroll lock shared by every open dialog (one may still be exiting as another opens) */
let scrollLocks = 0;

function lockScroll(lenis: Lenis | undefined) {
  scrollLocks += 1;
  if (scrollLocks > 1) return;
  const root = document.documentElement;
  root.style.overflow = 'hidden';
  root.style.scrollbarGutter = 'stable';
  lenis?.stop();
}

function unlockScroll(lenis: Lenis | undefined) {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks > 0) return;
  const root = document.documentElement;
  root.style.overflow = '';
  root.style.scrollbarGutter = '';
  lenis?.start();
}

export function ProjectDetailsModal({
  project,
  number,
  onClose,
}: {
  project: Project;
  /** 1-based position in the full project list, shown as "№03" */
  number: number;
  onClose: () => void;
}) {
  const { title, images, url, startDate, thumbnail } = project;
  const name = title.trim();
  const slides = useSlides(images.length);
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  const lenis = useLenis();
  const titleId = useId();

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
    <div className="pdm">
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
        initial={{ opacity: 0, y: 48, scale: 0.92, filter: 'blur(16px)' }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          transitionEnd: { filter: 'none' },
        }}
        exit={{
          opacity: 0,
          y: 28,
          scale: 0.96,
          filter: 'blur(10px)',
          transition: { duration: 0.3, ease: easeIn },
        }}
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
          <ProjectBody project={project} number={number} slides={slides} headingLevel={3} />
        </div>
      </m.div>
    </div>,
    document.body
  );
}

export default ProjectDetailsModal;
