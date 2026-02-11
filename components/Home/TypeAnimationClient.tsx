'use client';

import { TypeAnimation } from 'react-type-animation';

export const TypeAnimationClient = ({ titles }: { titles: string[] }) => {
  const sequence = titles.map((x) => [x, 1500]).flat();

  return (
    <TypeAnimation
      sequence={sequence}
      wrapper="h2"
      speed={35}
      className="home__header__titles"
      preRenderFirstString
      repeat={Infinity}
      aria-live="polite"
      aria-label="Job titles"
    />
  );
};
