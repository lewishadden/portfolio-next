'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { preload } from 'react-dom';
import Image, { getImageProps } from 'next/image';
import { AnimatePresence, m } from 'framer-motion';
import { Icon } from '@iconify/react';

import ProjectArt from '../ProjectArt/ProjectArt';
import { techIconClass } from '../techIcon';

import type { CSSProperties, PointerEvent } from 'react';
import type { Project } from '@/types';

import './ProjectBody.scss';

type ProjectImage = Project['images'][number];

const ease = [0.16, 1, 0.3, 1] as const;
const slideSizes = '(min-width: 1180px) 1080px, 100vw';
const swipeThreshold = 44;

export const pad = (n: number) => String(n).padStart(2, '0');
const isLogo = (size: ProjectImage['size']) => size.width / size.height > 2.2;

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: `${dir * 7}%`, scale: 1.04, filter: 'blur(12px)' }),
  center: { opacity: 1, x: '0%', scale: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({ opacity: 0, x: `${dir * -7}%`, scale: 0.97, filter: 'blur(12px)' }),
};

/** Carousel position + direction of travel (for the slide animation) */
export function useSlides(count: number) {
  const [[index, direction], setSlide] = useState<[number, number]>([0, 0]);

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

  return { index, direction, step, select };
}

export type Slides = ReturnType<typeof useSlides>;

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
      className="project-gallery"
      aria-roledescription="carousel"
      aria-label={`${title} screenshots`}
      onKeyDown={(e) => {
        if (!multiple || e.altKey || e.metaKey || e.ctrlKey) return;
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        e.stopPropagation();
        onStep(e.key === 'ArrowRight' ? 1 : -1);
      }}
    >
      <div
        className="project-gallery__stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        <AnimatePresence initial={false} custom={direction}>
          <m.figure
            key={index}
            className={`project-gallery__slide${logo ? ' project-gallery__slide--logo' : ''}`}
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
              className="project-gallery__ambient"
              loading="eager"
            />
            <span className="project-gallery__plate">
              <Image
                src={image.url}
                alt={altFor(image, index)}
                fill
                sizes={logo ? '640px' : slideSizes}
                className="project-gallery__img"
                loading="eager"
                fetchPriority={index === 0 ? 'high' : 'auto'}
                draggable={false}
              />
            </span>
          </m.figure>
        </AnimatePresence>

        <span className="project-gallery__scan" aria-hidden="true" />
        {['tl', 'tr', 'bl', 'br'].map((corner) => (
          <span
            key={corner}
            className={`project-gallery__corner project-gallery__corner--${corner}`}
            aria-hidden="true"
          />
        ))}

        {multiple && (
          <>
            <button
              type="button"
              className="project-gallery__nav project-gallery__nav--prev"
              onClick={() => onStep(-1)}
              aria-label="Previous screenshot"
            >
              <Icon icon="ph:caret-left-bold" width={20} height={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="project-gallery__nav project-gallery__nav--next"
              onClick={() => onStep(1)}
              aria-label="Next screenshot"
            >
              <Icon icon="ph:caret-right-bold" width={20} height={20} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {multiple && (
        <div className="project-gallery__bar">
          <p className="project-gallery__count" aria-hidden="true">
            <b>{pad(index + 1)}</b>
            <span>/</span>
            {pad(count)}
          </p>
          <div className="project-gallery__dots" role="group" aria-label="Choose a screenshot">
            {images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                className="project-gallery__dot"
                onClick={() => onSelect(i)}
                aria-label={`Show screenshot ${i + 1} of ${count}`}
                aria-current={i === index ? 'true' : undefined}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          {image.alt && (
            <p className="project-gallery__caption" aria-hidden="true">
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

/**
 * Everything below a project's title: screenshot carousel (or generated art),
 * overview, facts, live-site link and stack. `headingLevel` keeps the outline
 * correct under the modal's h2 or the page's h1.
 */
export function ProjectBody({
  project,
  number,
  slides,
  headingLevel = 3,
}: {
  project: Project;
  /** 1-based position in the full project list */
  number: number;
  slides: Slides;
  headingLevel?: 2 | 3;
}) {
  const { title, description, images, technologies, url, startDate, thumbnail } = project;
  const name = title.trim();
  const count = images.length;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  const facts = [
    { term: 'Year', detail: startDate },
    { term: 'Stack', detail: `${technologies.length} tech` },
    { term: 'Shots', detail: count ? pad(count) : '—' },
  ];

  return (
    <div className="project-body">
      {count > 0 ? (
        <Gallery
          key={name}
          images={images}
          title={name}
          index={slides.index}
          direction={slides.direction}
          onStep={slides.step}
          onSelect={slides.select}
        />
      ) : (
        <div className="project-gallery">
          <div className="project-gallery__stage project-gallery__stage--art">
            <ProjectArt icon={thumbnail} tone={number} />
          </div>
        </div>
      )}

      <div className="project-body__content">
        <div className="project-body__main">
          <Heading className="project-body__label">
            <span aria-hidden="true">{'// '}</span>Overview
          </Heading>
          <p className="project-body__desc">{description}</p>
        </div>

        <aside className="project-body__side" aria-label="Project facts">
          <dl className="project-body__facts">
            {facts.map(({ term, detail }) => (
              <div key={term} className="project-body__fact">
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
              className="btn btn--primary project-body__visit"
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

          <div className="project-body__stack">
            <Heading className="project-body__label">
              <span aria-hidden="true">{'// '}</span>Built with
            </Heading>
            <ul className="project-body__tech">
              {technologies.map((t, i) => (
                <li
                  key={t.name}
                  className="project-body__tech-item"
                  style={{ '--i': i } as CSSProperties}
                >
                  <span className="project-body__tech-icon" aria-hidden="true">
                    <Icon
                      icon={t.class}
                      width={22}
                      height={22}
                      className={techIconClass(t.class)}
                    />
                  </span>
                  <span className="project-body__tech-name">{t.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ProjectBody;
