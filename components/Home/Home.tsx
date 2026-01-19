'use client';

import { Container, Stack } from 'react-bootstrap';
import { TypeAnimation } from 'react-type-animation';
// import { Icon } from '@iconify/react';
// import { Parallax } from 'react-parallax';
// import ExportedImage from 'next-image-export-optimizer';

import { ChevronDown, CodeIcon } from 'icons';
// import { GitHubCornerSVG } from 'icons';
// import { githubRepoUrl } from 'config';
import { BasicInfo } from '@/types';

import './Home.scss';

export const Home = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { name, titles } = basicInfo;

  const titlesUpperCased = titles.map((x) => [x, 1500]).flat();

  return (
    <section id="home" className="home" aria-label="Hero section">
      {/* <a
          href={githubRepoUrl}
          target="_blank"
          className="home__github-corner"
          aria-label="View source on GitHub"
          rel="noreferrer"
        >
          <GitHubCornerSVG />
        </a> */}
      <Container className="d-flex home__wrapper">
        <Stack as="header" gap={5} className="home__header center" style={{ zIndex: 2 }}>
          <CodeIcon className="home__header__icon" aria-hidden="true" />
          <TypeAnimation
            sequence={[name]}
            wrapper="h1"
            speed={15}
            cursor={false}
            className="home__header__name font-trebuchet"
            aria-label={name}
          />
          <TypeAnimation
            sequence={titlesUpperCased}
            wrapper="p"
            speed={35}
            className="home__header__titles"
            repeat={Infinity}
            aria-live="polite"
            aria-label="Job titles"
          />
        </Stack>
        <div className="home__chevron-down d-flex" style={{ zIndex: 3 }} role="presentation">
          <ChevronDown />
        </div>
      </Container>
    </section>
  );
};

export default Home;
