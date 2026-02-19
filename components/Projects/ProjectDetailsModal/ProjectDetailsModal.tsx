'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import Image from 'next/image';

import { useFocusTrap } from '@/hooks/useFocusTrap';

import { Project, Technology } from '@/types';

import './ProjectDetailsModal.scss';

const TechIcons = ({ technologies }: { technologies: Technology[] }) => (
  <div className="project-details__modal__body__tech-section">
    <h4 className="project-details__modal__body__tech-section__heading">Built with</h4>
    <ul className="project-details__modal__body__tech-section__list">
      {technologies.map((icon, i) => (
        <li className="project-details__modal__body__skill" key={i}>
          <Icon icon={icon.class} className="project-details__modal__body__skill__icon" />
          <p className="project-details__modal__body__skill__name">{icon.name}</p>
        </li>
      ))}
    </ul>
  </div>
);

const ProjectDetailsModal = ({
  show,
  onHide,
  data,
}: {
  data: Project;
  show: boolean;
  onHide: () => void;
}) => {
  const maxSliderHeightPercent = 56;
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [paddingHeight, setPaddingHeight] = useState(maxSliderHeightPercent);
  const { technologies, images, title, description, url } = data;
  const titleId = `project-details-modal-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(show);
  const [prevTitle, setPrevTitle] = useState(title);

  const scrollModalToTop = useCallback(() => {
    const scrollModal = () => {
      modalBodyRef.current?.scrollTo(0, 0);
    };
    scrollModal();
    requestAnimationFrame(scrollModal);
    setTimeout(scrollModal, 50);
    setTimeout(scrollModal, 150);
  }, []);

  // Reset slide index when data changes
  if (title !== prevTitle) {
    setPrevTitle(title);
    setActiveIndex(0);
  }

  // Lock body scroll when open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
      scrollModalToTop();
      setTimeout(() => dialogRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [show, scrollModalToTop]);

  // Close on Escape
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onHide();
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onHide();
  };

  // Close on backdrop keyboard
  const handleBackdropKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onHide();
    }
  };

  const goToSlide = useCallback(
    (index: number) => {
      setActiveIndex(index);

      const realIndex = ((index % images.length) + images.length) % images.length;
      const img = imageRefs.current[realIndex];
      if (img && img.offsetWidth > 0) {
        const newPaddingHeight = Math.min(
          (img.offsetHeight / img.offsetWidth) * 100,
          maxSliderHeightPercent
        );
        setPaddingHeight(newPaddingHeight);
      }
    },
    [images.length]
  );

  // After transitioning to a clone slide, snap to the real slide without animation
  const handleTransitionEnd = useCallback(() => {
    if (activeIndex >= images.length) {
      setTransitionEnabled(false);
      setActiveIndex(0);
    } else if (activeIndex < 0) {
      setTransitionEnabled(false);
      setActiveIndex(images.length - 1);
    }
  }, [activeIndex, images.length]);

  // Re-enable transition after a snap reset
  useEffect(() => {
    if (!transitionEnabled) {
      // Force a reflow so the snap is applied before re-enabling transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionEnabled(true);
        });
      });
    }
  }, [transitionEnabled]);

  const handleCarouselKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToSlide(activeIndex + 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToSlide(activeIndex - 1);
    }
  };

  const setImageRef = (index: number) => (el: HTMLImageElement | null) => {
    imageRefs.current[index] = el;
  };

  const getImageSlides = () => {
    // Clone last slide before first and first slide after last for seamless looping
    const lastImage = images[images.length - 1];
    const firstImage = images[0];
    // Track offset: index 0 maps to translateX(-100%) because of the prepended clone
    const trackOffset = (activeIndex + 1) * 100;
    const realIndex = ((activeIndex % images.length) + images.length) % images.length;

    const carouselId = `carousel-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const slidePanelId = (i: number) => `${carouselId}-slide-${i}`;

    return (
      <div
        className="project-details__carousel"
        role="group"
        aria-label="Project image carousel"
        aria-roledescription="carousel"
      >
        <div
          className="project-details__carousel__track"
          aria-label={`Slide ${realIndex + 1} of ${images.length}`}
          aria-live="polite"
          aria-atomic="true"
          style={{
            transform: `translateX(-${trackOffset}%)`,
            transition: transitionEnabled ? undefined : 'none',
            paddingBottom: `${paddingHeight}%`,
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {/* Clone of last slide (prepended) */}
          <div className="project-details__carousel__slide" aria-hidden="true">
            <Image
              src={lastImage.url}
              width={lastImage.size.width}
              height={lastImage.size.height}
              alt=""
              className="project-details__carousel__img"
              sizes="(min-width: 992px) 60vw, 90vw"
              loading="lazy"
            />
          </div>

          {/* Real slides */}
          {images.map(({ url: imageUrl, size, alt: imageAlt }, i) => (
            <div
              key={i}
              id={slidePanelId(i)}
              className="project-details__carousel__slide"
              role="tabpanel"
              aria-roledescription="slide"
              aria-label={`Slide ${i + 1} of ${images.length}`}
              aria-hidden={i !== realIndex}
            >
              <Image
                src={imageUrl}
                width={size.width}
                height={size.height}
                alt={imageAlt || `Screenshot of ${title} project`}
                className="project-details__carousel__img"
                ref={setImageRef(i)}
                sizes="(min-width: 992px) 60vw, 90vw"
                loading={i === 0 ? 'eager' : 'lazy'}
                onLoad={(e) => {
                  if (i !== activeIndex) return;
                  const { offsetWidth, offsetHeight } = e.target as HTMLImageElement;
                  if (offsetWidth === 0) return;
                  const newPaddingHeight = Math.min(
                    (offsetHeight / offsetWidth) * 100,
                    maxSliderHeightPercent
                  );
                  setPaddingHeight(newPaddingHeight);
                }}
              />
            </div>
          ))}

          {/* Clone of first slide (appended) */}
          <div className="project-details__carousel__slide" aria-hidden="true">
            <Image
              src={firstImage.url}
              width={firstImage.size.width}
              height={firstImage.size.height}
              alt=""
              className="project-details__carousel__img"
              sizes="(min-width: 992px) 60vw, 90vw"
              loading="lazy"
            />
          </div>
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              className="project-details__carousel__btn project-details__carousel__btn--prev"
              onClick={() => goToSlide(activeIndex - 1)}
              aria-label="Previous image"
              aria-controls={slidePanelId((realIndex - 1 + images.length) % images.length)}
            >
              <Icon icon="mdi:chevron-left" />
            </button>
            <button
              type="button"
              className="project-details__carousel__btn project-details__carousel__btn--next"
              onClick={() => goToSlide(activeIndex + 1)}
              aria-label="Next image"
              aria-controls={slidePanelId((realIndex + 1) % images.length)}
            >
              <Icon icon="mdi:chevron-right" />
            </button>

            <div
              className="project-details__carousel__dots"
              role="tablist"
              aria-label="Slide controls"
            >
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  className={`project-details__carousel__dot${i === realIndex ? ' project-details__carousel__dot--active' : ''}`}
                  onClick={() => goToSlide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-selected={i === realIndex}
                  aria-controls={slidePanelId(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  if (!show) return null;

  return (
    <div className="project-details__overlay" ref={focusTrapRef}>
      <button
        type="button"
        className="project-details__backdrop"
        onClick={handleBackdropClick}
        onKeyDown={handleBackdropKeyDown}
        aria-label="Close modal"
        tabIndex={-1}
      />
      <div
        className="project-details__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="project-details__modal__header">
          <h3 id={titleId} className="project-details__modal__header__title">
            {title}
          </h3>
          <button
            type="button"
            className="project-details__close-btn"
            onClick={onHide}
            aria-label="Close"
          >
            <Icon icon="mdi:close" aria-hidden="true" />
          </button>
        </div>

        <div
          className="project-details__modal__body"
          ref={modalBodyRef}
          tabIndex={-1}
          onKeyDown={handleCarouselKeyDown}
        >
          <div className="project-details__modal__body__inner">
            {images.length > 0 && getImageSlides()}
            <p className="project-details__modal__body__description">{description}</p>
            {url && (
              <Link
                prefetch={false}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="project-details__modal__body__link-button"
                aria-label={`Visit ${title} live site`}
              >
                <Icon icon="majesticons:open" aria-hidden="true" />
                <span>Visit Live Site</span>
              </Link>
            )}
          </div>
          <div className="project-details__modal__body__tech-wrapper">
            <TechIcons technologies={technologies} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailsModal;
