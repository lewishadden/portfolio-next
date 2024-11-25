'use client';

import { TypographyStylesProvider } from '@mantine/core';

export type TextSectionProps = {
  html: string;
  bold?: boolean;
  title?: boolean;
  indent?: boolean;
  fz?: string;
  color?: string;
  className?: string;
};

export function TextSection({
  html,
  bold = false,
  title = false,
  indent = false,
  fz,
  color,
  className = '',
}: TextSectionProps) {
  let fontSize;
  if (fz) fontSize = fz;
  else if (title) fontSize = '1.2rem';
  else fontSize = '0.8rem';

  if (!color) color = title ? 'var(--mantine-color-custom-red-8)' : 'black';

  return (
    <TypographyStylesProvider>
      <div
        dangerouslySetInnerHTML={{
          __html: html,
        }}
        className={className}
        style={{
          fontWeight: bold ? 'bold' : 'normal',
          fontSize,
          marginLeft: indent ? '1rem' : '0',
          color,
        }}
      />
    </TypographyStylesProvider>
  );
}
