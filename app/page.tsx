import { Header } from 'components/Header/Header';
import { Background } from 'components/Background/Background';
import { Home } from 'components/Home/Home';
import { About } from 'components/About/About';
import { Experience } from 'components/Experience/Experience';
import { Projects } from 'components/Projects/Projects';
import { Skills } from 'components/Skills/Skills';
import { Contact } from 'components/Contact/Contact';
import { Footer } from 'components/Footer/Footer';

import { getPageContent } from 'utils/serverUtils';

import { ResumeData } from '@/types';

import './page.scss';

export default async () => {
  const pageData: ResumeData = await getPageContent();
  const { basicInfo, experience, projects, skills, contact } = pageData;

  return (
    <>
      <Header />
      <Background />
      <main id="main-content">
        <Home basicInfo={pageData.basicInfo} />
        <About basicInfo={pageData.basicInfo} />
        <Experience experience={experience} basicInfo={basicInfo} />
        <Projects projects={projects} basicInfo={basicInfo} />
        <Skills skills={skills} basicInfo={basicInfo} />
        <Contact basicInfo={basicInfo} contact={contact} />
        <Footer basicInfo={basicInfo} />
      </main>
    </>
  );
};
