'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';

import { Reveal, RevealGroup, RevealItem } from 'components/Motion/Reveal';
import { ScrambleText } from 'components/Motion/ScrambleText';

import { usePointerGlow } from '@/hooks/usePointerGlow';
import { ExploreItem } from '@/types';

import './Explore.scss';

const ExploreCard = ({ item, index }: { item: ExploreItem; index: number }) => {
  const ref = usePointerGlow<HTMLAnchorElement>({ tilt: 7 });
  return (
    <RevealItem as="li" className="explore__cell">
      <Link href={item.href} className="explore__card glass spotlight" ref={ref}>
        <span className="explore__top">
          <span className="explore__icon" aria-hidden="true">
            <Icon icon={item.icon} width={26} height={26} />
          </span>
          <span className="explore__index" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
        </span>
        <span className="explore__title">{item.title}</span>
        <span className="explore__text">{item.text}</span>
        <span className="explore__go" aria-hidden="true">
          Launch <Icon icon="ph:arrow-right-bold" width={14} height={14} />
        </span>
      </Link>
    </RevealItem>
  );
};

/** Home page "mission control" — one card per destination */
export const Explore = ({
  label,
  title,
  items,
}: {
  label: string;
  title: string;
  items: ExploreItem[];
}) => (
  <section className="explore" aria-labelledby="explore-heading">
    <Reveal className="explore__head">
      <p className="eyebrow">
        <span className="eyebrow__line" aria-hidden="true" />
        <ScrambleText text={label} />
      </p>
      <h2 id="explore-heading" className="explore__heading">
        {title}
      </h2>
    </Reveal>
    <RevealGroup as="ul" className="explore__grid" stagger={0.1}>
      {items.map((item, i) => (
        <ExploreCard key={item.href} item={item} index={i} />
      ))}
    </RevealGroup>
  </section>
);

export default Explore;
