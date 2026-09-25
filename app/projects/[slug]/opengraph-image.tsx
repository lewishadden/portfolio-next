import { ogContentType, ogSize, renderOgImage } from '@/app/_og/OgImage';
import { getPageContent } from '@/utils/serverUtils';

import type { ResumeData } from '@/types';

export const alt = 'Project by Lewis Hadden';
export const size = ogSize;
export const contentType = ogContentType;

// Prerendered with the pages — the renderer reads its assets from disk at build time
export const dynamicParams = false;

export async function generateStaticParams() {
  const { items } = ((await getPageContent()) as ResumeData).projects;
  return items.map(({ slug }) => ({ slug }));
}

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { items } = ((await getPageContent()) as ResumeData).projects;
  const index = items.findIndex((p) => p.slug === slug);
  const project = items[Math.max(0, index)];
  const words = project.title.trim().split(/\s+/);
  const accent = words.pop();

  return renderOgImage({
    index: '03',
    label: `Project ${String(index + 1).padStart(2, '0')}`,
    title: words.join(' '),
    accent,
    description: project.description,
    chips: [project.startDate, ...project.technologies.slice(0, 4).map((t) => t.name)],
    render: 'terminal',
  });
}
