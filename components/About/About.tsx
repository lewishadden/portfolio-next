'use client';

import Image, { ImageLoader } from 'next/image';
import { Icon } from '@iconify/react';

import { About as AboutProps, Global } from '@/types';
import Magnet from 'components/Magnet/Magnet';

import './About.scss';

const maxImageWidth = 640;
const aboutImageLoader: ImageLoader = ({ src, width, quality }) => {
  const w = Math.min(width, maxImageWidth);
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${quality || 75}`;
};

export const About = ({
  about,
  openToWork,
  name,
  location,
}: {
  about: AboutProps;
  openToWork: boolean;
  name: string;
  location: string;
}) => {
  const { image, label, title, description, descriptionHeader, highlights, cta, cv } = about;

  return (
    <section id="about" className="section about" aria-labelledby="about-heading">
      <div className="section__num">01</div>
      <div className="section__head reveal">
        <span className="section__label">{label}</span>
        <h2 id="about-heading" className="section__title">
          {title} <span className="section__title-accent">Me</span>
        </h2>
      </div>

      <div className="about__grid">
        <div className="about__media reveal">
          <Image
            src={image.url}
            className="about__media-img"
            width={image.size.width}
            height={image.size.height}
            alt={`Portrait of ${name}`}
            loader={aboutImageLoader}
            sizes="(min-width: 900px) 520px, calc(100vw - 40px)"
            priority
          />
          <div className="about__media-tag">
            <div>
              <b>{name}</b>
              <span>{location}</span>
            </div>
            {openToWork && <small>● Available</small>}
          </div>
        </div>

        <div className="about__body">
          {descriptionHeader && (
            <h3
              className="about__title reveal"
              dangerouslySetInnerHTML={{ __html: descriptionHeader }}
            />
          )}
          <div
            className="about__copy reveal"
            style={{ '--reveal-delay': '120ms' } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: description }}
          />

          <div
            className="about__highlights reveal"
            style={{ '--reveal-delay': '260ms' } as React.CSSProperties}
          >
            {highlights.map((h) => (
              <div className="about__hl" key={h.title}>
                <Icon icon={h.icon} width={24} height={24} aria-hidden="true" />
                <b>{h.title}</b>
                <span>{h.sub}</span>
              </div>
            ))}
          </div>

          <div
            className="about__actions reveal"
            style={{ '--reveal-delay': '380ms' } as React.CSSProperties}
          >
            <Magnet>
              <a
                href={cta.primary.url}
                download={cv.download}
                className="btn btn--primary"
                aria-label={cta.primary.ariaLabel}
              >
                {cta.primary.icon && (
                  <Icon icon={cta.primary.icon} width={18} height={18} aria-hidden="true" />
                )}
                <span>{cta.primary.text}</span>
              </a>
            </Magnet>
            <Magnet>
              <a
                href={cta.secondary.url}
                className="btn btn--secondary"
                aria-label={cta.secondary.ariaLabel}
              >
                {cta.secondary.icon && (
                  <Icon icon={cta.secondary.icon} width={18} height={18} aria-hidden="true" />
                )}
                <span>{cta.secondary.text}</span>
              </a>
            </Magnet>
          </div>
        </div>
      </div>
    </section>
  );
};

// Helper type so we re-export Global (currently unused, but keeps imports tidy)
export type { Global };

export default About;
