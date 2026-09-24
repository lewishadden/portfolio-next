'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal, preload } from 'react-dom';
import Image, { getImageProps } from 'next/image';
import { AnimatePresence, m } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useLenis } from 'lenis/react';

import { ScrambleText } from 'components/Motion/ScrambleText';

import { useFocusTrap } from '@/hooks/useFocusTrap';

import ProjectArt from '../ProjectArt/ProjectArt';
import { techIconClass } from '../techIcon';

import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import type Lenis from 'lenis';
import type { Project } from '@/types';

import './ProjectDetailsModal.scss';

type ProjectImage = Project['images'][number];

const ease = [0.16, 1, 0.3, 1] as const;
const easeIn = [0.65, 0, 0.35, 1] as const;
const slideSizes = '(min-width: 1180px) 1080px, 100vw';
const swipeThreshold = 44;

const pad = (n: number) => String(n).padStart(2, '0');
const isLogo = (size: ProjectImage['size']) => size.width / size.height > 2.2;

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: `${dir * 7}%`, scale: 1.04, filter: 'blur(12px)' }),
  center: { opacity: 1, x: '0%', scale: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({ opacity: 0, x: `${dir * -7}%`, scale: 0.97, filter: 'blur(12px)' }),
};

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

/** Warm the cache for a slide the visitor is likely to open next */
function preloadSlide(image: ProjectImage) {
  const { props } = getImageProps({ src: image.url, alt: '', fill: true, sizes: slideSizes });
  preload(props.src, {
    as: 'image',
    imageSrcSet: props.srcSet,
    imageSizes: props.sizes,
    fetchPriority: 'low',
  });
}

function Gallery({
  images,
  title,
  index,
  direction,
  onStep,
  onSelect,
}: {
  images: ProjectImage[];
  title: string;
  index: number;
  direction: number;
  onStep: (delta: number) => void;
  onSelect: (index: number) => void;
}) {
  const count = images.length;
  const multiple = count > 1;
  const image = images[index];
  const logo = isLogo(image.size);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const altFor = (img: ProjectImage, i: number) =>
    img.alt || `${title} — screenshot ${i + 1} of ${count}`;

  useEffect(() => {
    if (!multiple) return;
    preloadSlide(images[(index + 1) % count]);
    preloadSlide(images[(index - 1 + count) % count]);
  }, [images, index, count, multiple]);

  const onPointerDown = (e: PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || !multiple) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > swipeThreshold && Math.abs(dx) > Math.abs(dy) * 1.2) {
      onStep(dx < 0 ? 1 : -1);
    }
  };

  return (
    <section
      className="pdm-gallery"
      aria-roledescription="carousel"
      aria-label={`${title} screenshots`}
    >
      <div
        className="pdm-gallery__stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        <AnimatePresence initial={false} custom={direction}>
          <m.figure
            key={index}
            className={`pdm-gallery__slide${logo ? ' pdm-gallery__slide--logo' : ''}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.65, ease }}
          >
            <Image
              src={image.url}
              alt=""
              aria-hidden="true"
              fill
              sizes="96px"
              className="pdm-gallery__ambient"
              loading="eager"
            />
            <span className="pdm-gallery__plate">
              <Image
                src={image.url}
                alt={altFor(image, index)}
                fill
                sizes={logo ? '640px' : slideSizes}
                className="pdm-gallery__img"
                loading="eager"
                fetchPriority={index === 0 ? 'high' : 'auto'}
                draggable={false}
              />
            </span>
          </m.figure>
        </AnimatePresence>

        <span className="pdm-gallery__scan" aria-hidden="true" />
        {['tl', 'tr', 'bl', 'br'].map((corner) => (
          <span
            key={corner}
            className={`pdm-gallery__corner pdm-gallery__corner--${corner}`}
            aria-hidden="true"
          />
        ))}

        {multiple && (
          <>
            <button
              type="button"
              className="pdm-gallery__nav pdm-gallery__nav--prev"
              onClick={() => onStep(-1)}
              aria-label="Previous screenshot"
            >
              <Icon icon="ph:caret-left-bold" width={20} height={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pdm-gallery__nav pdm-gallery__nav--next"
              onClick={() => onStep(1)}
              aria-label="Next screenshot"
            >
              <Icon icon="ph:caret-right-bold" width={20} height={20} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {multiple && (
        <div className="pdm-gallery__bar">
          <p className="pdm-gallery__count" aria-hidden="true">
            <b>{pad(index + 1)}</b>
            <span>/</span>
            {pad(count)}
          </p>
          <div className="pdm-gallery__dots" role="group" aria-label="Choose a screenshot">
            {images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                className="pdm-gallery__dot"
                onClick={() => onSelect(i)}
                aria-label={`Show screenshot ${i + 1} of ${count}`}
                aria-current={i === index ? 'true' : undefined}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          {image.alt && (
            <p className="pdm-gallery__caption" aria-hidden="true">
              {image.alt}
            </p>
          )}
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {multiple ? `Screenshot ${index + 1} of ${count}: ${altFor(image, index)}` : ''}
      </p>
    </section>
  );
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
  const { title, description, images, technologies, url, startDate, thumbnail } = project;
  const name = title.trim();
  const count = images.length;
  const [[index, direction], setSlide] = useState<[number, number]>([0, 0]);
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  const lenis = useLenis();
  const titleId = useId();

  const step = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setSlide(([i]) => [(i + delta + count) % count, delta]);
    },
    [count]
  );

  const select = useCallback((target: number) => {
    setSlide((prev) => (prev[0] === target ? prev : [target, target > prev[0] ? 1 : -1]));
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

  // Left / right arrows flip through the screenshots
  const onKeyDown = (e: KeyboardEvent) => {
    if (count < 2 || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
    }
  };

  const facts = [
    { term: 'Year', detail: startDate },
    { term: 'Stack', detail: `${technologies.length} tech` },
    { term: 'Shots', detail: count ? pad(count) : '—' },
  ];

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
          {count > 0 ? (
            <Gallery
              key={name}
              images={images}
              title={name}
              index={index}
              direction={direction}
              onStep={step}
              onSelect={select}
            />
          ) : (
            <div className="pdm-gallery">
              <div className="pdm-gallery__stage pdm-gallery__stage--art">
                <ProjectArt icon={thumbnail} tone={number} />
              </div>
            </div>
          )}

          <div className="pdm__content">
            <div className="pdm__main">
              <h3 className="pdm__label">
                <span aria-hidden="true">{'// '}</span>Overview
              </h3>
              <p className="pdm__desc">{description}</p>
            </div>

            <aside className="pdm__side" aria-label="Project facts">
              <dl className="pdm__facts">
                {facts.map(({ term, detail }) => (
                  <div key={term} className="pdm__fact">
                    <dt>{term}</dt>
                    <dd>{detail}</dd>
                  </div>
                ))}
              </dl>

              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--primary pdm__visit"
                >
                  <Icon
                    icon="ph:globe-hemisphere-west-bold"
                    width={18}
                    height={18}
                    aria-hidden="true"
                  />
                  <span>Visit live site</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                  <Icon icon="ph:arrow-up-right-bold" width={16} height={16} aria-hidden="true" />
                </a>
              )}

              <div className="pdm__stack">
                <h3 className="pdm__label">
                  <span aria-hidden="true">{'// '}</span>Built with
                </h3>
                <ul className="pdm__tech">
                  {technologies.map((t, i) => (
                    <li
                      key={t.name}
                      className="pdm__tech-item"
                      style={{ '--i': i } as CSSProperties}
                    >
                      <span className="pdm__tech-icon" aria-hidden="true">
                        <Icon
                          icon={t.class}
                          width={22}
                          height={22}
                          className={techIconClass(t.class)}
                        />
                      </span>
                      <span className="pdm__tech-name">{t.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </m.div>
    </div>,
    document.body
  );
}

export default ProjectDetailsModal;
