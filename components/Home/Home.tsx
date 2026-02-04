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
      <Container className="d-flex home__wrapper">
        <Stack as="header" gap={5} className="home__header center" style={{ zIndex: 2 }}>
          <CodeIcon className="home__header__icon" aria-hidden="true" />
          <h1 id="home-heading" className="home__header__name font-trebuchet">
            {name}
          </h1>
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
        </Stack>
        <div className="home__chevron-down d-flex" style={{ zIndex: 3 }} role="presentation">
          <ChevronDown />
        </div>
      </Container>
    </section>
  );
};

export default Home;
