'use client';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import ExportedImage from 'next-image-export-optimizer';

import { BasicInfo } from '@/types';
import ScrollReveal from '@/components/ScrollReveal/ScrollReveal';

import './About.scss';

export const About = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { image, sectionName, description, descriptionHeader, cv } = basicInfo;
  const headingText = sectionName.about;
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <section id="about" className="about" aria-labelledby="about-heading">
      <div className="about__container">
        <div className="about__heading-wrapper">
          <span className="about__label">Get to know me</span>
          <h2 id="about-heading" className="about__heading">
            {headingText}
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
              <div className="about__card__status">
                <span className="about__card__status-dot" />
                <span className="about__card__status-text">Available for opportunities</span>
              </div>

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
                  href={cv.url}
                  download="Lewis_Hadden_CV.pdf"
                  className="about__card__btn about__card__btn--primary"
                  aria-label="Download CV as PDF"
                >
                  <svg
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
                  </svg>
                  Download CV
                </a>
                <a
                  href="#contact"
                  className="about__card__btn about__card__btn--secondary"
                  aria-label="Go to contact section"
                >
                  Get in Touch
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
