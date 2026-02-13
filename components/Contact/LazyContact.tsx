'use client';

import dynamic from 'next/dynamic';

import { Contact as ContactProps } from '@/types';

const Contact = dynamic(() => import('./Contact').then((m) => m.Contact), {
  ssr: false,
});

export function LazyContact({ contact }: { contact: ContactProps }) {
  return <Contact contact={contact} />;
}
