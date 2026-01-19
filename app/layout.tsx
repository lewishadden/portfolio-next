import '@mantine/core/styles.css';
import 'bootstrap/scss/bootstrap.scss';
import './globals.scss';
import React from 'react';
import { MantineProvider } from '@mantine/core';
import { Layout } from 'components/Layout/Layout';
import type { Metadata, Viewport } from 'next';

import content from '../content/content.json';
import { theme } from '../theme';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

const personName = content.basicInfo?.name || 'Portfolio';
const description =
  'Welcome to my online portfolio. Freelance Senior/Lead Full Stack Engineer with expertise in React, Next.js, Node.js, and Azure.';
const profileImage = content.basicInfo?.image?.url || '/static/images/portrait.png';
const sameAs = (content.basicInfo?.social || []).map((s: any) => s.url).filter(Boolean);

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${personName} — Freelance Full Stack Developer`,
    template: `%s | ${personName}`,
  },
  description,
  applicationName: personName,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: personName,
    title: `${personName} — Freelance Full Stack Developer`,
    description,
    images: [
      {
        url: profileImage,
        width: content.basicInfo?.image?.size?.width || 1200,
        height: content.basicInfo?.image?.size?.height || 630,
        alt: `${personName} portrait`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${personName} — Freelance Full Stack Developer`,
    description,
    images: [profileImage],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
  },
};

function JsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: personName,
    url: siteUrl,
    image: new URL(profileImage, siteUrl).toString(),
    email: content.basicInfo?.contactInfo?.find((c: any) => c.name === 'Email')?.value,
    jobTitle: content.basicInfo?.titles?.[0] || 'Full Stack Engineer',
    sameAs,
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en">
      <body data-theme="dark" data-bs-theme="dark">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <MantineProvider forceColorScheme="light" theme={theme}>
          <Layout>{children}</Layout>
        </MantineProvider>
        <JsonLd />
      </body>
    </html>
  );
}
