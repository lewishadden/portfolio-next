import { Experience } from 'components/Experience/Experience';
import { Footer } from 'components/Footer/Footer';
import { Home } from 'components/Home/Home';
import { Projects } from 'components/Projects/Projects';
import { Skills } from 'components/Skills/Skills';
import { Contact } from 'components/Contact/Contact';
import { About } from 'components/About/About';

import { getPageContent } from 'utils/serverUtils';

import { ResumeData } from '@/types';

export default async () => {
  const pageData: ResumeData = await getPageContent();
  return (
    <>
      <Home basicInfo={pageData.basicInfo} />
      <About basicInfo={pageData.basicInfo} />
      <Experience experience={pageData.experience} basicInfo={pageData.basicInfo} />
      <Projects projects={pageData.projects} basicInfo={pageData.basicInfo} />
      <Skills skills={pageData.skills} basicInfo={pageData.basicInfo} />
      <Contact basicInfo={pageData.basicInfo} />
      <Footer basicInfo={pageData.basicInfo} />
    </>
  );
};
