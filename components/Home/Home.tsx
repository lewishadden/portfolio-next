'use client';

import dynamic from 'next/dynamic';
import { Container, Stack } from 'react-bootstrap';
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
  const fallbackTitle = titles[0] ?? '';

  const NameAnimation = dynamic(
    () => import('react-type-animation').then((mod) => mod.TypeAnimation),
    {
      ssr: false,
      loading: () => (
        <h1 className="home__header__name font-trebuchet" aria-label={name}>
          {name}
        </h1>
      ),
    },
  );

  const TitlesAnimation = dynamic(
    () => import('react-type-animation').then((mod) => mod.TypeAnimation),
    {
      ssr: false,
      loading: () => (
        <p className="home__header__titles" aria-live="polite" aria-label="Job titles">
          {fallbackTitle}
        </p>
      ),
    },
  );

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
          <NameAnimation
            sequence={[name]}
            wrapper="h1"
            speed={15}
            cursor={false}
            className="home__header__name font-trebuchet"
            aria-label={name}
          />
          <TitlesAnimation
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
