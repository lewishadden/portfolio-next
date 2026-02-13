import { Icon } from '@iconify/react';
import { ChevronDown, CodeIcon } from 'icons';
import { TypeAnimationClient } from './TypeAnimationClient';

import { BasicInfo } from '@/types';

import './Home.scss';

export const Home = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { name, titles, openToWork } = basicInfo;

  return (
    <section id="home" className="home" aria-labelledby="home-heading">
      <div className="home__bg-accent" aria-hidden="true" />
      <div className="home__wrapper">
        <header className="home__header center" style={{ zIndex: 2 }}>
          {openToWork && (
            <div className="home__header__badge">
              <span className="home__header__badge-dot"></span>
              <span className="home__header__badge-text">Open to Work</span>
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

          <p className="home__header__tagline">
            Building exceptional digital experiences with modern web technologies
          </p>

          <div className="home__header__actions">
            <a
              href="#contact"
              className="home__header__btn home__header__btn--primary"
              aria-label="Contact me"
            >
              <Icon icon="mdi:email" width={20} height={20} aria-hidden="true" />
              Let&rsquo;s Talk
            </a>
            <a
              href="#projects"
              className="home__header__btn home__header__btn--secondary"
              aria-label="View my work"
            >
              <Icon icon="mdi:image-multiple" width={20} height={20} aria-hidden="true" />
              View Work
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
