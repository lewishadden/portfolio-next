import { ogContentType, ogSize, personName, renderOgImage } from './_og/OgImage';
import content from '../content/content.json';

export const alt = `${personName} — Freelance React & Next.js Developer, Peterborough UK`;
export const size = ogSize;
export const contentType = ogContentType;

const [first, ...rest] = personName.split(' ');

export default function OpenGraphImage() {
  return renderOgImage({
    label: content.home?.titles?.[0] || 'Senior Full Stack Engineer',
    title: first,
    accent: rest.join(' '),
    description: 'Freelance React & Next.js developer — Peterborough, UK · UK & EU remote.',
    chips: ['React', 'Next.js', 'TypeScript', 'Node.js', 'Cloud'],
    render: 'astronaut',
  });
}
