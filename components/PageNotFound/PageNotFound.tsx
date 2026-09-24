'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@iconify/react';

import Magnet from 'components/Magnet/Magnet';
import { Reveal } from 'components/Motion/Reveal';
import { ScrambleText } from 'components/Motion/ScrambleText';
import { StationFallback, illustrations } from 'components/World/StationFallback';

import './PageNotFound.scss';

export type PageNotFoundProps = {
  title: string;
  description: string;
  cta: {
    text: string;
  };
};

export const PageNotFound = ({ title, description, cta }: PageNotFoundProps) => {
  const pathname = usePathname();

  return (
    <section className="page lost" aria-labelledby="lost-heading">
      <StationFallback src={illustrations.astronaut} />
      <div className="lost__inner">
        <p className="lost__code" data-text="404" aria-hidden="true">
          404
        </p>

        <Reveal y={20}>
          <p className="eyebrow">
            <span className="eyebrow__index">ERR</span>
            <span className="eyebrow__line" aria-hidden="true" />
            <ScrambleText text="Signal lost" trigger="mount" delay={300} />
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <h1 id="lost-heading" className="page-title">
            {title}
          </h1>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="page-sub">{description}</p>
        </Reveal>

        <Reveal delay={0.22} className="lost__terminal glass">
          <p>
            <span className="lost__prompt">$</span> ping {pathname || '/unknown'}
          </p>
          <p className="lost__muted">Request timed out — no station at these coordinates.</p>
          <p>
            <span className="lost__prompt">$</span> plot-course /
            <span className="lost__caret" aria-hidden="true" />
          </p>
        </Reveal>

        <Reveal delay={0.3} className="lost__actions">
          <Magnet>
            <Link href="/" className="btn btn--primary">
              <Icon icon="ph:house-line-bold" width={18} height={18} aria-hidden="true" />
              <span>{cta.text}</span>
            </Link>
          </Magnet>
          <Magnet>
            <Link href="/contact" className="btn btn--ghost">
              <Icon icon="ph:broadcast-bold" width={18} height={18} aria-hidden="true" />
              <span>Report a broken link</span>
            </Link>
          </Magnet>
        </Reveal>
      </div>
    </section>
  );
};
