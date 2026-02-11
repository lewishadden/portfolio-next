'use client';

import Link from 'next/link';

import { Illustration } from './Illustration';
import './PageNotFound.scss';

export type PageNotFoundProps = {
  title: string;
  description: string;
  cta: {
    text: string;
  };
};

export function PageNotFound({ title, description, cta }: PageNotFoundProps) {
  return (
    <div className="not-found">
      <div className="not-found__inner">
        <Illustration className="not-found__image" />
        <div className="not-found__content">
          <h1 className="not-found__title">{title}</h1>
          <p className="not-found__description">{description}</p>
          <div className="not-found__actions">
            <Link href="/" className="not-found__btn" aria-label={cta.text}>
              {cta.text}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
