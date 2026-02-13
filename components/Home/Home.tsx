import { Icon } from '@iconify/react';
import { ChevronDown, CodeIcon } from 'icons';
import { TypeAnimationClient } from './TypeAnimationClient';

import { Home as HomeProps } from '@/types';

import './Home.scss';

export const Home = ({ home, openToWork }: { home: HomeProps; openToWork: boolean }) => {
  const { name, titles, openToWorkText, tagline, cta } = home;

  return (
    <section id="home" className="home" aria-labelledby="home-heading">
      <div className="home__bg-accent" aria-hidden="true" />
      <div className="home__wrapper">
        <header className="home__header center" style={{ zIndex: 2 }}>
          {openToWork && (
            <div className="home__header__badge">
              <span className="home__header__badge-dot"></span>
              <span className="home__header__badge-text">{openToWorkText}</span>
            </div>
          )}

          <div className="home__header__icon-wrapper">
            <CodeIcon className="home__header__icon" aria-hidden="true" />
            <div className="home__header__icon-glow"></div>
          </div>

          <div className="home__header__text">
            <p className="home__header__greeting">Hi, I&rsquo;m</p>
            <h1 id="home-heading" className="home__header__name font-trebuchet">
              {name}
            </h1>
            <div className="home__header__title-wrapper">
              <TypeAnimationClient titles={titles} />
            </div>
          </div>

          <p className="home__header__tagline">{tagline}</p>

          <div className="home__header__actions">
            <a
              href={cta.primary.url}
              className="home__header__btn home__header__btn--primary"
              aria-label={cta.primary.ariaLabel}
            >
              {cta.primary.icon && (
                <Icon icon={cta.primary.icon} width={20} height={20} aria-hidden="true" />
              )}
              {cta.primary.text}
            </a>
            <a
              href={cta.secondary.url}
              className="home__header__btn home__header__btn--secondary"
              aria-label={cta.secondary.ariaLabel}
            >
              {cta.secondary.icon && (
                <Icon icon={cta.secondary.icon} width={20} height={20} aria-hidden="true" />
              )}
              {cta.secondary.text}
            </a>
          </div>
        </header>
      </div>
      <div className="home__chevron-down" role="presentation">
        <ChevronDown />
      </div>
    </section>
  );
};

export default Home;
