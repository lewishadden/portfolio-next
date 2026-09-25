import { notFound } from 'next/navigation';

import { ProjectPage } from 'components/Projects/ProjectPage/ProjectPage';
import { PageJsonLd } from 'components/Seo/PageJsonLd';

import { getPageContent } from 'utils/serverUtils';
import { pageMetadata, siteUrl } from 'utils/seo';
import { projectPath } from 'utils/projectPaths';

import type { Metadata } from 'next';
import type { Project, ResumeData } from '@/types';

type Params = Promise<{ slug: string }>;

// Every project page is generated at build time; unknown slugs 404
export const dynamicParams = false;

async function getProjects(): Promise<Project[]> {
  const content: ResumeData = await getPageContent();
  return content.projects.items;
}

/** Search/social description: the first sentence or two, capped for snippets */
function summarise(text: string, max = 158) {
  if (text.length <= max) return text;
  const cut = text.slice(0, text.lastIndexOf(' ', max - 1));
  return `${cut.replace(/[\s,.;:—–-]+$/, '')}…`;
}

export async function generateStaticParams() {
  return (await getProjects()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const project = (await getProjects()).find((p) => p.slug === slug);
  if (!project) return {};
  return pageMetadata({
    path: projectPath(slug),
    title: `${project.title.trim()} — Project`,
    description: summarise(project.description),
  });
}

export default async function ProjectSlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  const projects = await getProjects();
  const index = projects.findIndex((p) => p.slug === slug);
  if (index < 0) notFound();

  const project = projects[index];
  const name = project.title.trim();
  const path = projectPath(slug);
  const neighbour = (offset: number) => {
    const i = (index + offset + projects.length) % projects.length;
    return { project: projects[i], number: i + 1 };
  };

  const creativeWork = {
    '@type': 'CreativeWork',
    '@id': `${siteUrl}${path}/#work`,
    name,
    description: project.description,
    dateCreated: project.startDate,
    author: { '@id': `${siteUrl}/#person` },
    keywords: project.technologies.map((t) => t.name).join(', '),
    ...(project.url && { url: project.url }),
    ...(project.images[0] && { image: `${siteUrl}${project.images[0].url}` }),
  };

  return (
    <>
      <PageJsonLd
        path={path}
        name={name}
        description={summarise(project.description)}
        type="ItemPage"
        parents={[{ name: 'Projects', path: '/projects' }]}
        mainEntity={creativeWork}
      />
      <ProjectPage
        project={project}
        number={index + 1}
        total={projects.length}
        previous={neighbour(-1)}
        next={neighbour(1)}
      />
    </>
  );
}
