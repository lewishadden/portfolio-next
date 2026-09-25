import { ogContentType, ogSize, renderOgImage } from '@/app/_og/OgImage';

export const alt = 'Lewis Hadden — tech stack and skills';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return renderOgImage({
    index: '04',
    label: 'Skills',
    title: 'Tech',
    accent: 'stack',
    description: 'The full stack used to ship modern web platforms, front end to cloud.',
    chips: ['React', 'Next.js', 'TypeScript', 'Azure & AWS'],
  });
}
