import Link from 'next/link';
import { Icon } from '@iconify/react';

import Magnet from 'components/Magnet/Magnet';
import { Marquee } from 'components/Marquee/Marquee';
import { ArrowScribble, Spark, Squiggle } from 'components/Doodles/Doodles';
import { Stamp } from 'components/Doodles/Stamp';

import { Home as HomeProps } from '@/types';

import './Home.scss';

export const Home = ({
  home,
  openToWork,
  openToWorkText,
}: {
  home: HomeProps;
  openToWork: boolean;
  openToWorkText: string;
}) => {
  const { name, titles, tagline, cta } = home;
  const [firstName, ...restName] = name.split(' ');
  const surname = restName.join(' ');
  // First item repeated at the end so the CSS rotator loops seamlessly
  const rotatorTitles = [...titles, titles[0]];

  return (
    <section id="home" className="hero" aria-labelledby="home-heading">
      <div className="hero__inner">
        <div className="hero__content">
          {openToWork && (
            <p className="hero__badge">
              <span className="hero__badge-dot" aria-hidden="true" />
              {openToWorkText}
            </p>
          )}

          <p className="hero__greeting">
            <span aria-hidden="true">( </span>hello, I&rsquo;m
            <span aria-hidden="true"> )</span>
          </p>

          <h1 id="home-heading" className="hero__name">
            <span className="hero__word">
              <span className="hero__word-inner">{firstName}</span>
            </span>{' '}
            <span className="hero__word hero__word--accent">
              <span className="hero__word-inner">
                {surname}
                <Squiggle className="hero__squiggle" delay={1.1} />
              </span>
            </span>
          </h1>

          <p className="hero__role">
            <span className="sr-only">{titles.join(', ')}</span>
            <span className="hero__roles" aria-hidden="true">
              <span className="hero__roles-list">
                {rotatorTitles.map((t, i) => (
                  <span className="hero__roles-item" key={`${t}-${i}`}>
                    {t}
                  </span>
                ))}
              </span>
            </span>
          </p>

          <p className="hero__tag">{tagline}</p>

          <div className="hero__ctas">
            <Magnet>
              <Link
                href={cta.primary.url}
                className="btn btn--primary"
                aria-label={cta.primary.ariaLabel}
              >
                {cta.primary.icon && (
                  <Icon icon={cta.primary.icon} width={18} height={18} aria-hidden="true" />
                )}
                <span>{cta.primary.text}</span>
              </Link>
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
          </div>
        </div>

        <div className="hero__aside" aria-hidden="true">
          <Spark className="hero__spark" delay={1.5} />
          <Stamp text={`${openToWorkText} ✳ `} id="hero-stamp" className="hero__stamp" />
          <ArrowScribble className="hero__arrow" delay={1.8} />
        </div>
      </div>

      <Marquee items={[...titles, openToWorkText]} className="hero__marquee" duration={44} />

      <div className="hero__scroll-cue" aria-hidden="true">
        <span className="hero__scroll-text">scroll</span>
        <span className="hero__scroll-line" />
      </div>
    </section>
  );
};

export default Home;
