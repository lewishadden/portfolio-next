'use client';

import Image, { ImageLoader } from 'next/image';
import Link from 'next/link';
import { Icon } from '@iconify/react';

import Magnet from 'components/Magnet/Magnet';
import { PageHead } from 'components/PageHead/PageHead';
import { Reveal, RevealGroup, RevealItem } from 'components/Motion/Reveal';

import { usePointerGlow } from '@/hooks/usePointerGlow';

import { About as AboutProps, Highlight } from '@/types';

import './About.scss';

const maxImageWidth = 1200;
const aboutImageLoader: ImageLoader = ({ src, width, quality }) => {
  const w = Math.min(width, maxImageWidth);
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${quality || 75}`;
};

const HighlightCard = ({ highlight }: { highlight: Highlight }) => {
  const ref = usePointerGlow<HTMLDivElement>({ tilt: 6 });
  return (
    <RevealItem className="about__hl-cell">
      <div className="about__hl glass spotlight" ref={ref}>
        <span className="about__hl-icon" aria-hidden="true">
          <Icon icon={highlight.icon} width={22} height={22} />
        </span>
        <h2 className="about__hl-title">{highlight.title}</h2>
        <p className="about__hl-sub">{highlight.sub}</p>
      </div>
    </RevealItem>
  );
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
  const { image, label, title, description, highlights, cta, cv } = about;
  const portraitRef = usePointerGlow<HTMLDivElement>({ tilt: 10 });

  return (
    <section id="about" className="page about" aria-labelledby="about-heading">
      <PageHead
        id="about-heading"
        index="01"
        label={label}
        title={title}
        accent="me"
        sub={`Senior full stack engineer · ${location} · shipping production software since 2018.`}
      />

      <div className="about__grid">
        <Reveal className="about__media" y={60} scale={0.94}>
          <div className="about__frame" ref={portraitRef}>
            <div className="about__frame-inner">
              <Image
                src={image.url}
                className="about__img"
                width={image.size.width}
                height={image.size.height}
                alt={`Portrait of ${name}`}
                loader={aboutImageLoader}
                sizes="(min-width: 900px) 460px, calc(100vw - 48px)"
                priority
              />
              <span className="about__scan" aria-hidden="true" />
              <span className="about__grid-overlay" aria-hidden="true" />
            </div>
            {['tl', 'tr', 'bl', 'br'].map((corner) => (
              <span
                key={corner}
                className={`about__corner about__corner--${corner}`}
                aria-hidden="true"
              />
            ))}
            <div className="about__tag glass">
              <div>
                <b>{name}</b>
                <span>{location}</span>
              </div>
              {openToWork && (
                <small>
                  <span className="about__tag-dot" aria-hidden="true" />
                  {about.openToWorkText}
                </small>
              )}
            </div>
          </div>
        </Reveal>

        <div className="about__body">
          <Reveal
            className="about__copy"
            delay={0.1}
            dangerouslySetInnerHTML={{ __html: description }}
          />

          <RevealGroup className="about__highlights" stagger={0.09} delay={0.1}>
            {highlights.map((h) => (
              <HighlightCard key={h.title} highlight={h} />
            ))}
          </RevealGroup>

          <Reveal className="about__actions" delay={0.15}>
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
                className="btn btn--ghost"
                aria-label={cta.secondary.ariaLabel}
              >
                {cta.secondary.icon && (
                  <Icon icon={cta.secondary.icon} width={18} height={18} aria-hidden="true" />
                )}
                <span>{cta.secondary.text}</span>
              </Link>
            </Magnet>
          </Reveal>
        </div>
      </div>

      <Reveal as="div" className="page-nav">
        <Magnet>
          <Link href="/experience" className="btn btn--primary">
            <Icon icon="ph:rocket-launch-bold" width={18} height={18} aria-hidden="true" />
            <span>View experience</span>
            <Icon icon="ph:arrow-right-bold" width={16} height={16} aria-hidden="true" />
          </Link>
        </Magnet>
        <Magnet>
          <Link href="/projects" className="btn btn--ghost">
            <Icon icon="ph:cube-focus-bold" width={18} height={18} aria-hidden="true" />
            <span>See projects</span>
          </Link>
        </Magnet>
      </Reveal>
    </section>
  );
};

export default About;
