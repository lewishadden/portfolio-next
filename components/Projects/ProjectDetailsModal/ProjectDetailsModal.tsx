'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Icon } from '@iconify/react';
import ExportedImage from 'next-image-export-optimizer';

import { Project } from '@/types';

import './ProjectDetailsModal.scss';

const AwesomeSlider = dynamic(() => import('react-awesome-slider'), {
  ssr: false,
  loading: () => <div aria-hidden="true" style={{ minHeight: 240 }} />,
});

const ProjectDetailsModal = ({
  show,
  onHide,
  data,
}: {
  data: Project;
  show: boolean;
  onHide: () => void;
}) => {
  const MAX_SLIDER_HEIGHT_PERCENT = 56;
  const [paddingHeight, setPaddingHeight] = useState(MAX_SLIDER_HEIGHT_PERCENT);
  const { technologies, images, title, description, url } = data;
  const titleId = `project-details-modal-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const scrollModalToTop = useCallback(() => {
    const scrollModal = () => {
      modalBodyRef.current?.scrollTo(0, 0);
    };
    scrollModal();
    requestAnimationFrame(scrollModal);
    setTimeout(scrollModal, 50);
    setTimeout(scrollModal, 150);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
      scrollModalToTop();
      // Focus the dialog
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

  const imageRefs = Array.from(images, () => useRef(null));

  const handleCarouselKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      sliderRef.current?.querySelector<HTMLButtonElement>('.awssld__next')?.click();
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      sliderRef.current?.querySelector<HTMLButtonElement>('.awssld__prev')?.click();
    }
  };

  const getImageSlides = () => (
    <div
      className="project-details__modal__body__image-container"
      ref={sliderRef}
      role="group"
      aria-label="Project image carousel"
    >
      <AwesomeSlider
        animation="cubeAnimation"
        className="project-details__modal__body__image-container__slider"
        style={{ '--slider-height-percentage': `${paddingHeight}%` }}
        onTransitionStart={(ref) => {
          const nextImg = imageRefs[ref.nextIndex].current as unknown as HTMLImageElement;
          const { offsetWidth, offsetHeight }: { offsetWidth: number; offsetHeight: number } =
            nextImg;
          const newPaddingHeight = Math.min(
            (offsetHeight / offsetWidth) * 100,
            MAX_SLIDER_HEIGHT_PERCENT
          );
          setPaddingHeight(newPaddingHeight);
        }}
      >
        {images.map(({ url: imageUrl, size }, i) => (
          <div key={i}>
            <ExportedImage
              src={imageUrl}
              width={size.width}
              height={size.height}
              alt={`Carousel Image ${i}`}
              className="project-details__modal__body__image-container__img"
              ref={imageRefs[i]}
              sizes="(min-width: 992px) 60vw, 90vw"
              loading="lazy"
              decoding="async"
              onLoad={(e) => {
                const { offsetWidth, offsetHeight }: { offsetWidth: number; offsetHeight: number } =
                  e.target as HTMLImageElement;
                const newPaddingHeight = Math.min(
                  (offsetHeight / offsetWidth) * 100,
                  MAX_SLIDER_HEIGHT_PERCENT
                );
                setPaddingHeight(newPaddingHeight);
              }}
            />
          </div>
        ))}
      </AwesomeSlider>
    </div>
  );

  const TechIcons = () => (
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

  if (!show) return null;

  return (
    <div
      className="project-details__overlay"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="project-details__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
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
            <TechIcons />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailsModal;
