import dynamic from 'next/dynamic';
import { Header } from 'components/Header/Header';
import { Background } from 'components/Background/Background';
import { Home } from 'components/Home/Home';
import { LazyContact } from 'components/Contact/LazyContact';

// Below-fold sections: lazy-loaded so their JS doesn't block LCP
const About = dynamic(() => import('components/About/About').then((m) => m.About));
const Experience = dynamic(() =>
  import('components/Experience/Experience').then((m) => m.Experience)
);
const Projects = dynamic(() => import('components/Projects/Projects').then((m) => m.Projects));
const Skills = dynamic(() => import('components/Skills/Skills').then((m) => m.Skills));
const Footer = dynamic(() => import('components/Footer/Footer').then((m) => m.Footer));

import { getPageContent } from 'utils/serverUtils';

import { ResumeData } from '@/types';

import './page.scss';

export default async function Page() {
  const pageData: ResumeData = await getPageContent();
  const { basicInfo, experience, projects, skills, contact } = pageData;

  return (
    <>
      <Header />
      <main id="main-content">
        <Home basicInfo={pageData.basicInfo} />
        <About basicInfo={pageData.basicInfo} />
        <Experience experience={experience} basicInfo={basicInfo} />
        <Projects projects={projects} basicInfo={basicInfo} />
        <Skills skills={skills} basicInfo={basicInfo} />
        <LazyContact basicInfo={basicInfo} contact={contact} />
        <Footer basicInfo={basicInfo} />
      </main>
      <Background />
    </>
  );
}
