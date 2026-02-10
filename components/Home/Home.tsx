'use client';

import { Container, Stack } from 'react-bootstrap';
import { TypeAnimation } from 'react-type-animation';
import { ChevronDown, CodeIcon } from 'icons';

import { BasicInfo } from '@/types';

import './Home.scss';

export const Home = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { name, titles } = basicInfo;

  const titlesUpperCased = titles.map((x) => [x, 1500]).flat();

  return (
    <section id="home" className="home" aria-labelledby="home-heading">
      <div className="home__bg-accent" aria-hidden="true" />
      <Container className="d-flex home__wrapper">
        <Stack as="header" gap={3} className="home__header center" style={{ zIndex: 2 }}>
          <div className="home__header__badge">
            <span className="home__header__badge-dot"></span>
            <span className="home__header__badge-text">Open to Work</span>
          </div>

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
              <TypeAnimation
                sequence={titlesUpperCased}
                wrapper="h2"
                speed={35}
                className="home__header__titles"
                preRenderFirstString
                repeat={Infinity}
                aria-live="polite"
                aria-label="Job titles"
              />
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
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z"
                  fill="currentColor"
                />
              </svg>
              Let&rsquo;s Talk
            </a>
            <a
              href="#projects"
              className="home__header__btn home__header__btn--secondary"
              aria-label="View my work"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.11 21 21 20.1 21 19V5C21 3.9 20.11 3 19 3ZM19 19H5V5H19V19ZM17.5 9.5C17.5 10.33 16.83 11 16 11C15.17 11 14.5 10.33 14.5 9.5C14.5 8.67 15.17 8 16 8C16.83 8 17.5 8.67 17.5 9.5ZM6 17L9 13L11 15.51L14 11L18 17H6Z"
                  fill="currentColor"
                />
              </svg>
              View Work
            </a>
          </div>
        </Stack>
      </Container>
      <div className="home__chevron-down" role="presentation">
        <ChevronDown />
      </div>
    </section>
  );
};

export default Home;
