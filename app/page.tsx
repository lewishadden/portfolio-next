import { Header } from 'components/Header/Header';
import { Background } from 'components/Background/Background';
import { Home } from 'components/Home/Home';
import { About } from 'components/About/About';
import LazySections from 'components/LazySections/LazySections';

import { getPageContent } from 'utils/serverUtils';

import { ResumeData } from '@/types';

import './page.scss';

export default async () => {
  const pageData: ResumeData = await getPageContent();
  return (
    <>
      <Header />
      <Background />
      <main id="main-content">
        <Home basicInfo={pageData.basicInfo} />
        <About basicInfo={pageData.basicInfo} />
        <LazySections
          basicInfo={pageData.basicInfo}
          experience={pageData.experience}
          projects={pageData.projects}
          skills={pageData.skills}
        />
      </main>
    </>
  );
};
