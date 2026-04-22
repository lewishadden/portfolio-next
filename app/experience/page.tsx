import { Experience } from 'components/Experience/Experience';

import { getPageContent } from 'utils/serverUtils';

import { ResumeData } from '@/types';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Experience',
  description:
    'Nine years leading engineering teams at IBM, ADP, ERGO — delivering React, Next.js, and cloud platforms across payroll, insurance, and government.',
  alternates: { canonical: '/experience' },
};

export default async function ExperiencePage() {
  const pageData: ResumeData = await getPageContent();
  const { experience } = pageData;

  return <Experience experience={experience} />;
}
