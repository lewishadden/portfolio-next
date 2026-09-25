import { ogContentType, ogSize, renderOgImage } from '@/app/_og/OgImage';

export const alt = 'Contact Lewis Hadden — freelance React & Next.js developer';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return renderOgImage({
    index: '05',
    label: 'Contact',
    title: 'Let’s',
    accent: 'connect',
    description:
      'Available for senior or lead full stack work — UK & EU remote, freelance or permanent.',
    render: 'rocket',
  });
}
