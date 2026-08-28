import { Experience } from 'components/Experience/Experience';
import { PageJsonLd } from 'components/Seo/PageJsonLd';

import { getPageContent } from 'utils/serverUtils';
import { pageMetadata } from 'utils/seo';

import { ResumeData } from '@/types';

import type { Metadata } from 'next';

const title = 'Experience — React, Next.js & Cloud';
const description =
  'Nine years leading engineering teams at IBM, ADP, ERGO — delivering React, Next.js, and cloud platforms across payroll, insurance, and government.';

export const metadata: Metadata = pageMetadata({ path: '/experience', title, description });

export default async function ExperiencePage() {
  const pageData: ResumeData = await getPageContent();
  const { experience } = pageData;

  return (
    <>
      <PageJsonLd path="/experience" name="Experience" description={description} />
      <Experience experience={experience} />
    </>
  );
}
