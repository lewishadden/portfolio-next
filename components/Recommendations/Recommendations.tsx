'use client';

import { Icon } from '@iconify/react';

import { Reveal, RevealGroup, RevealItem } from 'components/Motion/Reveal';

import { usePointerGlow } from '@/hooks/usePointerGlow';

import type { Recommendation } from '@/types';

import './Recommendations.scss';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const dateLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const ref = usePointerGlow<HTMLElement>({ tilt: 3 });
  return (
    <RevealItem className="recs__cell">
      <figure className="recs__card glass spotlight" ref={ref}>
        <p className="recs__signal" aria-hidden="true">
          <span className="recs__signal-dot" />
          Transmission received · {rec.source.label}
        </p>
        <span className="recs__quote-mark" aria-hidden="true">
          &ldquo;
        </span>
        <blockquote className="recs__quote" cite={rec.source.url} data-reading>
          {rec.text.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </blockquote>
        <figcaption className="recs__by">
          <span className="recs__avatar" aria-hidden="true">
            {initials(rec.name)}
          </span>
          <span className="recs__who">
            <b>{rec.name}</b>
            <span>
              {rec.title}, {rec.company}
            </span>
            <small>
              <time dateTime={rec.date}>{dateLabel(rec.date)}</time> · {rec.relationship}
            </small>
          </span>
          <a
            className="recs__source"
            href={rec.source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon icon="mdi:linkedin" width={18} height={18} aria-hidden="true" />
            <span>View on {rec.source.label}</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </figcaption>
      </figure>
    </RevealItem>
  );
}

/** Recommendations quoted verbatim from LinkedIn */
export function Recommendations({ items }: { items: Recommendation[] }) {
  if (!items.length) return null;
  return (
    <section className="recs" aria-labelledby="recs-heading" data-world-section="recommendations">
      <Reveal as="h2" id="recs-heading" className="recs__title" data-reading="large">
        <span className="recs__eyebrow" aria-hidden="true">
          {'// '}
        </span>
        In their words
      </Reveal>
      <RevealGroup className="recs__list" stagger={0.1}>
        {items.map((rec) => (
          <RecommendationCard key={rec.name} rec={rec} />
        ))}
      </RevealGroup>
    </section>
  );
}

export default Recommendations;
