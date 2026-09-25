import { ogContentType, ogSize, renderOgImage } from '@/app/_og/OgImage';

export const alt = 'Lewis Hadden — work experience at IBM, ADP and ERGO';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return renderOgImage({
    index: '02',
    label: 'Experience',
    title: 'Work',
    accent: 'experience',
    description:
      'Nine years leading engineering teams at IBM, ADP and ERGO across payroll, insurance and government.',
    render: 'satellite',
  });
}
