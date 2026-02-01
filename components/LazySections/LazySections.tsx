'use client';

import dynamic from 'next/dynamic';
import IconifyProvider from 'components/IconifyProvider/IconifyProvider';
import type { BasicInfo, Experience as ExperienceType, Project, Skills as SkillsType } from '@/types';

const loadingFallback = () => <div aria-hidden="true" style={{ minHeight: 200 }} />;

const Experience = dynamic(() => import('components/Experience/Experience').then((m) => m.Experience), {
  ssr: false,
  loading: loadingFallback,
});
const Projects = dynamic(() => import('components/Projects/Projects').then((m) => m.Projects), {
  ssr: false,
  loading: loadingFallback,
});
const Skills = dynamic(() => import('components/Skills/Skills').then((m) => m.Skills), {
  ssr: false,
  loading: loadingFallback,
});
const Contact = dynamic(() => import('components/Contact/Contact').then((m) => m.Contact), {
  ssr: false,
  loading: loadingFallback,
});
const Footer = dynamic(() => import('components/Footer/Footer').then((m) => m.Footer), {
  ssr: false,
  loading: loadingFallback,
});

type LazySectionsProps = {
  basicInfo: BasicInfo;
  experience: ExperienceType[];
  projects: Project[];
  skills: SkillsType;
};

const LazySections = ({ basicInfo, experience, projects, skills }: LazySectionsProps) => (
  <>
    <IconifyProvider />
    <Experience experience={experience} basicInfo={basicInfo} />
    <Projects projects={projects} basicInfo={basicInfo} />
    <Skills skills={skills} basicInfo={basicInfo} />
    <Contact basicInfo={basicInfo} />
    <Footer basicInfo={basicInfo} />
  </>
);

export default LazySections;
