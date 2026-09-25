import { ogContentType, ogSize, renderOgImage } from '@/app/_og/OgImage';

export const alt = 'About Lewis Hadden — senior full stack engineer, Peterborough UK';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return renderOgImage({
    index: '01',
    label: 'About',
    title: 'About',
    accent: 'me',
    description:
      'Senior full stack engineer based in Peterborough, UK. Nine years shipping React, Next.js & Azure.',
    render: 'helmet',
  });
}
