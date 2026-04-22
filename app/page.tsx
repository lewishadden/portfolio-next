import { Home } from 'components/Home/Home';
import { StatsStrip } from 'components/StatsStrip/StatsStrip';

import { getPageContent } from 'utils/serverUtils';

import { ResumeData } from '@/types';

export default async function Page() {
  const pageData: ResumeData = await getPageContent();
  const { global, home } = pageData;

  return (
    <>
      <Home home={home} openToWork={global.openToWork} openToWorkText={global.openToWorkText} />
      <StatsStrip stats={home.stats} />
    </>
  );
}
