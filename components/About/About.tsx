'use client';

import { Icon } from '@iconify/react';
import ExportedImage from 'next-image-export-optimizer';

import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';
import { useMediaQuery } from '@/hooks/useMediaQuery';

import { About as AboutProps } from '@/types';

import './About.scss';

export const About = ({ about, openToWork }: { about: AboutProps; openToWork: boolean }) => {
  const { openToWorkText, image, title, label, description, descriptionHeader, cta, cv } = about;
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <section id="about" className="about" aria-labelledby="about-heading">
      <div className="about__container">
        <div className="about__heading-wrapper">
          <span className="about__label">{label}</span>
          <h2 id="about-heading" className="about__heading">
            {title}
          </h2>
        </div>

        <ScrollReveal animation="fadeIn">
          <div className="about__card">
            <div className="about__card__image-col">
              <div className="about__card__image-wrapper">
                <ExportedImage
                  src={image.url}
                  className="about__card__image"
                  width={image.size.width}
                  height={image.size.height}
                  alt="Portrait photo of Lewis Hadden"
                  sizes="(min-width: 992px) 30vw, (min-width: 768px) 40vw, 100vw"
                  loading={isDesktop ? 'eager' : 'lazy'}
                  fetchPriority={isDesktop ? 'high' : 'low'}
                  preload={Boolean(isDesktop)}
                  decoding="async"
                />
              </div>
            </div>

            <div className="about__card__content">
              {openToWork && (
                <div className="about__card__status">
                  <span className="about__card__status-dot" />
                  <span className="about__card__status-text">{openToWorkText}</span>
                </div>
              )}

              <h3
                dangerouslySetInnerHTML={{ __html: descriptionHeader }}
                className="about__card__title"
              />

              <div
                dangerouslySetInnerHTML={{ __html: description }}
                className="about__card__description"
              />

              <div className="about__card__actions">
                <a
                  href={cta.primary.url}
                  download={cv.download}
                  className="about__card__btn about__card__btn--primary"
                  aria-label={cta.primary.ariaLabel}
                >
                  {cta.primary.icon && (
                    <Icon icon={cta.primary.icon} width={20} height={20} aria-hidden="true" />
                  )}
                  {/* <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 16L7 11L8.4 9.55L11 12.15V4H13V12.15L15.6 9.55L17 11L12 16ZM6 20C5.45 20 4.979 19.804 4.587 19.412C4.195 19.02 3.99934 18.5493 4 18V15H6V18H18V15H20V18C20 18.55 19.804 19.021 19.412 19.413C19.02 19.805 18.5493 20.0007 18 20H6Z"
                      fill="currentColor"
                    />
                  </svg> */}
                  {cta.primary.text}
                </a>
                <a
                  href={cta.secondary.url}
                  className="about__card__btn about__card__btn--secondary"
                  aria-label={cta.secondary.ariaLabel}
                >
                  {cta.secondary.icon && (
                    <Icon icon={cta.secondary.icon} width={20} height={20} aria-hidden="true" />
                  )}
                  {cta.secondary.text}
                </a>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default About;
