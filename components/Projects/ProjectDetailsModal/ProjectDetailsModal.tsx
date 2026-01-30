'use client';

import { useState, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Col, Modal } from 'react-bootstrap';
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
  const [paddingHeight, setPaddingHeight] = useState(100);
  const { technologies, images, title, description, url } = data;
  const titleId = `project-details-modal-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

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
          const newPaddingHeight = (offsetHeight / offsetWidth) * 100;
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
                const newPaddingHeight = (offsetHeight / offsetWidth) * 100;
                setPaddingHeight(newPaddingHeight);
              }}
            />
          </div>
        ))}
      </AwesomeSlider>
    </div>
  );

  const TechIcons = () => (
    <ul className="list-inline mx-auto">
      {technologies.map((icon, i) => (
        <li className="list-inline-item mx-3 project-details__modal__body__skill" key={i}>
          <Icon icon={icon.class} className="project-details__modal__body__skill__icon" />
          <p className="text-center project-details__modal__body__skill__name">{icon.name}</p>
        </li>
      ))}
    </ul>
  );

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      className="project-details__modal"
      aria-modal="true"
      aria-labelledby={titleId}
      restoreFocus
      autoFocus
      enforceFocus
      onEntered={() => {
        modalBodyRef.current?.focus();
      }}
    >
      <Modal.Header closeButton closeVariant="white" className="project-details__modal__header">
        <Col md={1} />
        <Col md={10}>
          <Modal.Title as="h3" id={titleId} className="project-details__modal__header__title">
            {title}
            {url && (
              <Link
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="project-details__modal__header__title__link"
                aria-label={`Find out more about ${title}`}
              >
                <Icon
                  icon="majesticons:open"
                  className="project-details__modal__header__title__link__icon"
                />
              </Link>
            )}
          </Modal.Title>
        </Col>
      </Modal.Header>

      <Modal.Body
        className="project-details__modal__body"
        ref={modalBodyRef}
        tabIndex={-1}
        onKeyDown={handleCarouselKeyDown}
      >
        <Col md={12}>
          <Col md={10} className="mx-auto">
            {images.length > 0 && getImageSlides()}
            <p className="project-details__modal__body__description">{description}</p>
          </Col>
        </Col>
        <Col md={12} className="text-center">
          <TechIcons />
        </Col>
      </Modal.Body>
    </Modal>
  );
};

export default ProjectDetailsModal;
