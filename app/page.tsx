import { Header } from 'components/Header/Header';
import { Background } from 'components/Background/Background';
import { ScrollProgress } from 'components/ScrollProgress/ScrollProgress';
import { RevealMount } from 'components/RevealMount/RevealMount';
import { Home } from 'components/Home/Home';
import { StatsStrip } from 'components/StatsStrip/StatsStrip';
import { About } from 'components/About/About';
import { Experience } from 'components/Experience/Experience';
import { Projects } from 'components/Projects/Projects';
import { Skills } from 'components/Skills/Skills';
import { LazyContact } from 'components/Contact/LazyContact';
import { Footer } from 'components/Footer/Footer';

import { getPageContent } from 'utils/serverUtils';

import { ResumeData } from '@/types';

import './page.scss';

export default async function Page() {
  const pageData: ResumeData = await getPageContent();
  const { global, header, home, about, experience, projects, skills, contact, footer } = pageData;

  return (
    <>
      <ScrollProgress />
      <RevealMount />
      <Header header={header} navItems={global.navItems} />
      <main id="main-content">
        <Home home={home} openToWork={global.openToWork} openToWorkText={global.openToWorkText} />
        <StatsStrip stats={home.stats} />
        <About
          about={about}
          openToWork={global.openToWork}
          name={footer.name}
          location={global.location}
        />
        <Experience experience={experience} />
        <Projects projects={projects} />
        <Skills skills={skills} />
        <LazyContact contact={contact} />
        <Footer footer={footer} navItems={global.navItems} />
      </main>
      <Background />
    </>
  );
}
