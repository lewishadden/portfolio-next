import { About } from 'components/About/About';

import { getPageContent } from 'utils/serverUtils';

import { ResumeData } from '@/types';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Senior full stack engineer based in Peterborough, UK. Nine years shipping React, Next.js & Azure at IBM, ADP, ERGO.',
  alternates: { canonical: '/about' },
};

export default async function AboutPage() {
  const pageData: ResumeData = await getPageContent();
  const { global, about, footer } = pageData;

  return (
    <About
      about={about}
      openToWork={global.openToWork}
      name={footer.name}
      location={global.location}
    />
  );
}
