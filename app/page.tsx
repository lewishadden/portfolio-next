import { Home } from 'components/Home/Home';
import { StatsStrip } from 'components/StatsStrip/StatsStrip';

import { getPageContent } from 'utils/serverUtils';
import { siteUrl, personName, siteDescription, contentUpdated } from 'utils/seo';

import { ResumeData } from '@/types';

// ProfilePage rich result requires mainEntity with an inline @type (Person/Organization)
const profilePageSchema = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  mainEntity: {
    '@type': 'Person',
    '@id': `${siteUrl}/#person`,
  },
  url: siteUrl,
  name: `${personName} - Professional Portfolio`,
  description: siteDescription,
  dateCreated: '2020-01-01T00:00:00.000Z',
  dateModified: new Date(contentUpdated).toISOString(),
};

export default async function Page() {
  const pageData: ResumeData = await getPageContent();
  const { global, home } = pageData;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profilePageSchema) }}
      />
      <Home home={home} openToWork={global.openToWork} openToWorkText={global.openToWorkText} />
      <StatsStrip stats={home.stats} />
    </>
  );
}
