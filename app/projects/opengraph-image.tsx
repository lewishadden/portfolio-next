import { ogContentType, ogSize, renderOgImage } from '@/app/_og/OgImage';

export const alt = 'Selected projects by Lewis Hadden';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return renderOgImage({
    index: '03',
    label: 'Projects',
    title: 'Selected',
    accent: 'projects',
    description:
      'Passion projects and enterprise platforms built with React, Next.js, TypeScript and the cloud.',
    render: 'terminal',
  });
}
