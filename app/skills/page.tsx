import { Skills } from 'components/Skills/Skills';

import { getPageContent } from 'utils/serverUtils';

import { ResumeData } from '@/types';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Skills',
  description:
    'Full stack skill set — React, Next.js, TypeScript, Node.js, Azure, AWS, and the broader stack used to ship modern web platforms.',
  alternates: { canonical: '/skills' },
};

export default async function SkillsPage() {
  const pageData: ResumeData = await getPageContent();
  const { skills } = pageData;

  return <Skills skills={skills} />;
}
