'use client';

import { Container, Stack } from 'react-bootstrap';
import { TypeAnimation } from 'react-type-animation';
import { Icon } from '@iconify/react';
import { Parallax } from 'react-parallax';

import { ChevronDown } from 'icons';
// import { GitHubCornerSVG } from 'icons';
// import { githubRepoUrl } from 'config';
import { BasicInfo } from '@/types';

import './Home.scss';

export const Home = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { name, titles } = basicInfo;

  const titlesUpperCased = titles.map((x) => [x, 1500]).flat();

  return (
    <section id="home" className="home">
      <Parallax
        blur={5}
        bgImage="static/images/nextImageExportOptimizer/hero-opt-1920.webp"
        bgImageAlt="hero image"
        strength={200}
      >
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
          <Stack as="header" gap={5} className="home__header center">
            <Icon className="home__header__icon" icon="line-md:document-code" />
            <TypeAnimation
              sequence={[name]}
              wrapper="h1"
              speed={15}
              cursor={false}
              className="home__header__name font-trebuchet"
            />
            <TypeAnimation
              sequence={titlesUpperCased}
              wrapper="p"
              speed={35}
              className="home__header__titles"
              repeat={Infinity}
            />
          </Stack>
          <div className="home__chevron-down d-flex">
            <ChevronDown />
          </div>
        </Container>
      </Parallax>
    </section>
  );
};

export default Home;
