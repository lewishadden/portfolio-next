'use client';

import { TypeAnimation } from 'react-type-animation';

export const TypeAnimationClient = ({ titles }: { titles: string[] }) => {
  const sequence = titles.map((x) => [x, 1500]).flat();

  return (
    <>
      <TypeAnimation
        sequence={sequence}
        wrapper="span"
        speed={35}
        className="hero__role-typed"
        preRenderFirstString
        repeat={Infinity}
        aria-live="polite"
        aria-label="Job titles"
      />
      <span className="hero__caret" aria-hidden="true" />
    </>
  );
};
