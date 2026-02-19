'use client';

import Image, { ImageLoader } from 'next/image';
import { Icon } from '@iconify/react';

import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';
import { useMediaQuery } from '@/hooks/useMediaQuery';

import { About as AboutProps } from '@/types';

import './About.scss';

const maxImageWidth = 640;
const aboutImageLoader: ImageLoader = ({ src, width, quality }) => {
  const w = Math.min(width, maxImageWidth);
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${quality || 75}`;
};

export const About = ({ about, openToWork }: { about: AboutProps; openToWork: boolean }) => {
  const { openToWorkText, image, title, label, description, descriptionHeader, cta, cv } = about;
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <section id="about" className="about" aria-labelledby="about-heading">
      <div className="about__container">
        <div className="about__heading-wrapper">
          <ScrollReveal animation="slideUp">
            <span className="about__label">{label}</span>
          </ScrollReveal>
          <ScrollReveal animation="slideUp" delay={0.1}>
            <h2 id="about-heading" className="about__heading">
              {title}
            </h2>
          </ScrollReveal>
        </div>

        <ScrollReveal animation="fadeIn">
          <div className="about__card">
            <div className="about__card__image-col">
              <div className="about__card__image-wrapper">
                <Image
                  src={image.url}
                  className="about__card__image"
                  width={image.size.width}
                  height={image.size.height}
                  alt="Portrait photo of Lewis Hadden"
                  loader={aboutImageLoader}
                  sizes="(min-width: 1170px) 471px, (min-width: 992px) calc((100vw - 2.5rem) * 0.417), calc(100vw - 2.5rem)"
                  loading={isDesktop ? 'eager' : 'lazy'}
                  fetchPriority={isDesktop ? 'high' : 'low'}
                  priority={Boolean(isDesktop)}
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
