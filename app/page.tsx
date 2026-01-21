import { Experience } from 'components/Experience/Experience';
import { Footer } from 'components/Footer/Footer';
import { Header } from 'components/Header/Header';
import { Background } from 'components/Background/Background';
import { Home } from 'components/Home/Home';
import { Projects } from 'components/Projects/Projects';
import { Skills } from 'components/Skills/Skills';
import { Contact } from 'components/Contact/Contact';
import { About } from 'components/About/About';

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
        <Experience experience={pageData.experience} basicInfo={pageData.basicInfo} />
        <Projects projects={pageData.projects} basicInfo={pageData.basicInfo} />
        <Skills skills={pageData.skills} basicInfo={pageData.basicInfo} />
        <Contact basicInfo={pageData.basicInfo} />
      </main>
      <Footer basicInfo={pageData.basicInfo} />
    </>
  );
};
