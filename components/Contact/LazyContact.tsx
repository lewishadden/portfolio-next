'use client';

import dynamic from 'next/dynamic';

import { Contact as ContactProps } from '@/types';

function ContactSkeleton() {
  return (
    <section
      id="contact"
      className="section contact"
      aria-busy="true"
      aria-label="Loading contact section"
    >
      <span className="section__slug" aria-hidden="true">
        {'// contact'}
      </span>
      <div className="contact__grid">
        <div className="contact__side" aria-hidden="true" />
        <div className="contact__panel" aria-hidden="true" />
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
