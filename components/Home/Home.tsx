import { Icon } from '@iconify/react';
import Magnet from 'components/Magnet/Magnet';
import { TypeAnimationClient } from './TypeAnimationClient';

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

  return (
    <section id="home" className="hero" aria-labelledby="home-heading">
      <div className="hero__inner">
        {openToWork && (
          <div className="hero__badge">
            <span className="hero__badge-dot" aria-hidden="true" />
            {openToWorkText}
          </div>
        )}

        <p className="hero__greeting">
          <span className="hero__wave" aria-hidden="true">
            👋
          </span>{' '}
          &nbsp;Hi, I&rsquo;m
        </p>

        <div className="hero__name-container">
          <div className="hero__aurora" aria-hidden="true">
            <div className="hero__aurora-item hero__aurora-item--1" />
            <div className="hero__aurora-item hero__aurora-item--2" />
            <div className="hero__aurora-item hero__aurora-item--3" />
          </div>
          <svg className="hero__name-svg" viewBox="0 0 1100 200" aria-labelledby="home-heading">
            <title id="home-heading">{name}</title>
            <defs>
              <linearGradient id="hero-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--gradient-start)" />
                <stop offset="50%" stopColor="var(--gradient-mid)" />
                <stop offset="100%" stopColor="var(--gradient-end)" />
              </linearGradient>
            </defs>
            <text className="hero__name-stroke" x="50%" y="145" textAnchor="middle">
              {name}
            </text>
            <text className="hero__name-fill" x="50%" y="145" textAnchor="middle">
              {name}
            </text>
          </svg>
        </div>

        <div className="hero__role">
          <TypeAnimationClient titles={titles} />
        </div>

        <p className="hero__tag">{tagline}</p>

        <div className="hero__ctas">
          <Magnet>
            <a
              href={cta.primary.url}
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

      <div className="hero__scroll-cue" aria-hidden="true">
        Scroll
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  );
};

export default Home;
