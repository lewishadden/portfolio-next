'use client';

import dynamic from 'next/dynamic';

import { Contact as ContactProps } from '@/types';

function ContactSkeleton() {
  return (
    <section
      id="contact"
      className="page contact"
      aria-busy="true"
      aria-label="Loading contact section"
    >
      <div className="contact__grid">
        <div className="contact__skeleton" aria-hidden="true" />
        <div className="contact__skeleton" aria-hidden="true" />
      </div>
    </section>
  );
}

// SSR stays on so crawlers see the full contact content; dynamic() still code-splits
const Contact = dynamic(() => import('./Contact').then((m) => m.Contact), {
  loading: () => <ContactSkeleton />,
});

export function LazyContact({ contact }: { contact: ContactProps }) {
  return <Contact contact={contact} />;
}
