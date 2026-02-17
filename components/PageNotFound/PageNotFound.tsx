'use client';

import Link from 'next/link';

import { Illustration } from './Illustration';

export type PageNotFoundProps = {
  title: string;
  description: string;
  cta: {
    text: string;
  };
};

const styles = `
.not-found{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:5rem 1.5rem;background:var(--bg-primary);color:var(--text-primary)}
.not-found__inner{position:relative;max-width:40rem;width:100%;margin:0 auto}
.not-found__image{position:relative;inset:0;opacity:.75;color:#c9c5c7}
.not-found__content{position:relative;z-index:1;padding-top:4.75rem;text-align:center}
.not-found__title{font-family:'Greycliff CF',var(--font-primary,sans-serif);text-align:center;font-weight:900;font-size:2.375rem;margin:0}
.not-found__description{max-width:33.75rem;margin:1.5rem auto 2.25rem;font-size:1.125rem;color:var(--text-secondary,#c9c5c7);line-height:1.6}
.not-found__actions{display:flex;justify-content:center}
.not-found__btn{display:inline-flex;align-items:center;justify-content:center;padding:.625rem 1.5rem;font-size:1rem;font-weight:600;border-radius:.375rem;text-decoration:none;cursor:pointer;background:var(--accent-primary);color:#fff;border:none;transition:opacity .2s ease}
.not-found__btn:hover{opacity:.9}
.not-found__btn:focus-visible{outline:2px solid var(--accent-primary);outline-offset:2px}
@media(max-width:48em){.not-found__content{padding-top:3.125rem}.not-found__title{font-size:2rem}}
`;

export const PageNotFound = ({ title, description, cta }: PageNotFoundProps) => {
  return (
    <div className="not-found">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
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
};
