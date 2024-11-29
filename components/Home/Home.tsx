'use client';

import { Container, Stack } from '@mantine/core';
import { TypeAnimation } from 'react-type-animation';
import { IconCode } from '@tabler/icons-react';

import { BasicInfo } from '@/types';

import classes from './Home.module.css';

export const Home = ({ basicInfo }: { basicInfo: BasicInfo }) => {
  const { name, titles } = basicInfo;

  const titlesUpperCased = titles.map((x: string) => [x, 1500]).flat();

  return (
    <section id="home" className={classes.home}>
      <Container className="">
        <Stack component="header" align="center" gap={5} className="">
          <IconCode className={classes.icon} />
          <TypeAnimation
            sequence={[name]}
            wrapper="h1"
            speed={15}
            cursor={false}
            className={classes.name}
          />
          <TypeAnimation
            sequence={titlesUpperCased}
            wrapper="p"
            speed={35}
            className={classes.titles}
            repeat={Infinity}
          />
        </Stack>
      </Container>
    </section>
  );
};
