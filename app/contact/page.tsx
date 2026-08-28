import { LazyContact } from 'components/Contact/LazyContact';
import { PageJsonLd } from 'components/Seo/PageJsonLd';

import { getPageContent } from 'utils/serverUtils';
import { pageMetadata } from 'utils/seo';

import { ResumeData } from '@/types';

import type { Metadata } from 'next';

const title = 'Contact — Hire a Freelance React Developer';
const description =
  'Get in touch — available for senior or lead full stack roles, UK & EU remote, freelance or permanent.';

export const metadata: Metadata = pageMetadata({ path: '/contact', title, description });

export default async function ContactPage() {
  const pageData: ResumeData = await getPageContent();
  const { contact } = pageData;

  return (
    <>
      <PageJsonLd path="/contact" name="Contact" description={description} type="ContactPage" />
      <LazyContact contact={contact} />
    </>
  );
}
