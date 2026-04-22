'use client';

import Image, { ImageLoader } from 'next/image';
import Link from 'next/link';
import { Icon } from '@iconify/react';

import { About as AboutProps, Global } from '@/types';
import Magnet from 'components/Magnet/Magnet';
import { ScrollReveal } from 'components/ScrollReveal/ScrollReveal';

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
      <ScrollReveal className="section__head">
        <span className="section__label">{label}</span>
        <h2 id="about-heading" className="section__title">
          {title} <span className="section__title-accent">Me</span>
        </h2>
      </ScrollReveal>

      <div className="about__grid">
        <ScrollReveal className="about__media">
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
        </ScrollReveal>

        <div className="about__body">
          {descriptionHeader && (
            <ScrollReveal
              as="h3"
              className="about__title"
              dangerouslySetInnerHTML={{ __html: descriptionHeader }}
            />
          )}
          <ScrollReveal
            className="about__copy"
            style={{ '--reveal-delay': '120ms' } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: description }}
          />

          <ScrollReveal
            className="about__highlights"
            style={{ '--reveal-delay': '260ms' } as React.CSSProperties}
          >
            {highlights.map((h) => (
              <div
                className="about__hl"
                key={h.title}
                onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                  e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
                }}
              >
                <Icon icon={h.icon} width={24} height={24} aria-hidden="true" />
                <b>{h.title}</b>
                <span>{h.sub}</span>
              </div>
            ))}
          </ScrollReveal>

          <ScrollReveal
            className="about__actions"
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
              <Link
                href={cta.secondary.url}
                className="btn btn--secondary"
                aria-label={cta.secondary.ariaLabel}
              >
                {cta.secondary.icon && (
                  <Icon icon={cta.secondary.icon} width={18} height={18} aria-hidden="true" />
                )}
                <span>{cta.secondary.text}</span>
              </Link>
            </Magnet>
          </ScrollReveal>
        </div>
      </div>

      <ScrollReveal className="section__page-nav">
        <Magnet>
          <Link href="/experience" className="btn btn--primary">
            <Icon icon="ph:briefcase" width={18} height={18} aria-hidden="true" />
            <span>View Experience</span>
          </Link>
        </Magnet>
        <Magnet>
          <Link href="/projects" className="btn btn--secondary">
            <Icon icon="ph:folder-open" width={18} height={18} aria-hidden="true" />
            <span>See Projects</span>
          </Link>
        </Magnet>
      </ScrollReveal>
    </section>
  );
};

// Helper type so we re-export Global (currently unused, but keeps imports tidy)
export type { Global };

export default About;
