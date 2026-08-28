import { Projects } from 'components/Projects/Projects';
import { PageJsonLd } from 'components/Seo/PageJsonLd';

import { getPageContent } from 'utils/serverUtils';
import { pageMetadata } from 'utils/seo';

import { ResumeData } from '@/types';

import type { Metadata } from 'next';

const title = 'Projects — React & Next.js Work';
const description =
  'Selected work — passion projects and enterprise platforms built with React, Next.js, TypeScript, and cloud infrastructure.';

export const metadata: Metadata = pageMetadata({ path: '/projects', title, description });

export default async function ProjectsPage() {
  const pageData: ResumeData = await getPageContent();
  const { projects } = pageData;

  return (
    <>
      <PageJsonLd
        path="/projects"
        name="Projects"
        description={description}
        type="CollectionPage"
      />
      <Projects projects={projects} />
    </>
  );
}
