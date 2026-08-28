import content from '../content/content.json';

import type { Metadata } from 'next';

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://portfolio.lewishadden.com';

export const personName = content.home?.name || 'Portfolio';

export const siteDescription =
  'Freelance React & Next.js developer, Peterborough UK. Senior full stack engineer. 9+ years at IBM, ADP & ERGO. Remote contracts across the UK and Europe.';

// Bump in content.json (global.contentUpdated) whenever site content meaningfully changes;
// feeds sitemap lastModified and ProfilePage dateModified.
export const contentUpdated = content.global?.contentUpdated || '2026-08-28';

const ogImage = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: `${personName} — Freelance React & Next.js Developer, Peterborough UK`,
  type: 'image/png',
};

/**
 * Complete per-page metadata. Next.js replaces (not merges) nested openGraph/twitter
 * objects from the root layout, so every field must be restated here — a page that
 * sets only openGraph.title would silently drop og:type, og:image, siteName, etc.
 */
export function pageMetadata({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}): Metadata {
  const fullTitle = `${title} | ${personName}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      siteName: `${personName} - Full Stack Developer`,
      title: fullTitle,
      description,
      locale: 'en_GB',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      creator: '@lewishadden',
      images: ['/opengraph-image'],
    },
  };
}
