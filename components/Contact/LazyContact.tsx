'use client';

import dynamic from 'next/dynamic';

import { Contact as ContactProps } from '@/types';

function ContactSkeleton() {
  return (
    <section className="contact" aria-busy="true" aria-label="Loading contact section">
      <div className="contact__container">
        <div className="contact__heading-wrapper">
          <div className="contact__skeleton contact__skeleton--label" />
          <div className="contact__skeleton contact__skeleton--title" />
          <div className="contact__skeleton contact__skeleton--tagline" />
        </div>
        <div className="contact__body">
          <div className="contact__info">
            <div className="contact__skeleton contact__skeleton--card" />
          </div>
          <div className="contact__skeleton contact__skeleton--form" />
        </div>
      </div>
    </section>
  );
}

const Contact = dynamic(() => import('./Contact').then((m) => m.Contact), {
  ssr: false,
  loading: () => <ContactSkeleton />,
});

export function LazyContact({ contact }: { contact: ContactProps }) {
  return <Contact contact={contact} />;
}
