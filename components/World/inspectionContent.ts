import { projectStories } from '@/content/worldStories';
import { getRoleId } from './inspectionTypes';

import type { InspectionCatalog } from './inspectionTypes';
import type { ResumeData } from '@/types';

// These links follow the employers, dates and projects named in content.json.
// Personal and freelance projects are not attributed to an unrelated employer.
const roleProjects: Record<string, string[]> = {
  'adp-senior-full-stack-engineer-contractor': ['adp-run'],
  'ergo-travel-insurance-lead-full-stack-engineer': ['sanctions-checker', 'airdoctor-webhook'],
  'sopra-steria-cloud-infrastructure-architect': ['home-greening-microsite'],
  'sopra-steria-lead-software-engineer': ['traffic-management-portal', 'audex'],
  'ibm-lead-front-end-developer': ['audi-form-builder'],
  'ibm-front-end-developer': ['cookie-control', 'audi-digital-transformation'],
};

// Match the naming variations already present in the source. These aliases do
// not infer a technology from another one (React, for example, is not Next.js).
const aliases: Record<string, string> = {
  angular: 'angular 8+',
  nodejs: 'node.js',
  'azure cosmosdb': 'cosmos db',
  'cypress io': 'cypress',
  'devops pipelines': 'ci/cd pipelines',
  'github workflows': 'github actions',
  'vite': 'vitejs',
  'anthropic claude': 'claude',
  'split tunnelling (vpn)': 'split tunnel vpn',
  html: 'html5',
};

const normalizeTechnology = (name: string) => aliases[name.toLowerCase()] ?? name.toLowerCase();
const technologyMatches = (technology: string, skill: string) => {
  const names = technology === 'Jest + Enzyme' ? ['Jest', 'Enzyme'] :
    technology === 'SCSS / CSS3' ? ['SCSS', 'CSS3'] : [technology];
  return names.some((name) => normalizeTechnology(name) === normalizeTechnology(skill));
};

/** A serialisable, sourced content layer shared by pages and the world. */
export function buildInspectionCatalog(content: ResumeData): InspectionCatalog {
  const projects = content.projects.items.map((project) => {
    const story = projectStories[project.slug];
    if (!story) throw new Error(`Missing inspection story for ${project.slug}`);
    return {
      id: project.slug,
      title: project.title.trim(),
      href: `/projects/${project.slug}`,
      url: project.url,
      description: project.description,
      technologies: project.technologies.map(({ name }) => name),
      images: project.images.map((image, index) => ({
        url: image.url,
        alt: image.alt ?? `${project.title.trim()} — screenshot ${index + 1}`,
        width: image.size.width,
        height: image.size.height,
        fullPage: image.fullPage === true,
      })),
      ...story,
    };
  });
  const roles = content.experience.items.map((role) => {
    const id = getRoleId(role.company, role.title);
    return {
      id,
      title: role.title,
      company: role.company,
      years: role.years,
      description: role.description ?? '',
      technologies: [...role.mainTech, ...role.technologies],
      projects: roleProjects[id] ?? [],
    };
  });
  return {
    projects,
    roles,
    skills: content.skills.icons.map((skill) => ({
      id: skill.name,
      name: skill.name,
      category: content.skills.categories.find(({ categoryKey }) => categoryKey === skill.category)?.title ?? skill.category,
      projects: projects.filter((project) => project.technologies.some((technology) => technologyMatches(technology, skill.name))).map(({ id }) => id),
      roles: roles.filter((role) => role.technologies.some((technology) => technologyMatches(technology, skill.name))).map(({ id }) => id),
    })),
    contact: content.contact,
    destinations: content.home.explore.map(({ href, title, text }) => ({ href, title, text })),
    about: {
      name: content.home.name,
      description: content.about.description,
      portrait: content.about.image.url,
      highlights: content.about.highlights.map(({ title, sub }) => ({ title, sub })),
      recommendations: content.about.recommendations ?? [],
      cv: { url: content.about.cta.primary.url, name: content.about.cv.download },
    },
  };
}
