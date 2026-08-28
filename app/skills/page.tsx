import { Skills } from 'components/Skills/Skills';
import { PageJsonLd } from 'components/Seo/PageJsonLd';

import { getPageContent } from 'utils/serverUtils';
import { pageMetadata } from 'utils/seo';

import { ResumeData } from '@/types';

import type { Metadata } from 'next';

const title = 'Skills — React, TypeScript, Node.js & Cloud';
const description =
  'Full stack skill set — React, Next.js, TypeScript, Node.js, Azure, AWS, and the broader stack used to ship modern web platforms.';

export const metadata: Metadata = pageMetadata({ path: '/skills', title, description });

export default async function SkillsPage() {
  const pageData: ResumeData = await getPageContent();
  const { skills } = pageData;

  return (
    <>
      <PageJsonLd path="/skills" name="Skills" description={description} />
      <Skills skills={skills} />
    </>
  );
}
