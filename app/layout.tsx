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
  'Lewis Hadden - Freelance Senior Full Stack Engineer & Lead Developer specializing in React, Next.js, TypeScript, Node.js, Azure, and AWS. Available for freelance contracts and permanent positions. 8+ years experience building enterprise applications.';
const keywords = [
  'Lewis Hadden',
  'Full Stack Developer',
  'React Developer',
  'Next.js Developer',
  'TypeScript Developer',
  'Frontend Developer',
  'Backend Developer',
  'Freelance Developer',
  'Contract Developer',
  'Azure Developer',
  'AWS Developer',
  'Node.js Developer',
  'Software Engineer',
  'Lead Developer',
  'Senior Developer',
  'UK Developer',
  'JavaScript Developer',
  'Web Developer',
];
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
    default: `${personName} — Freelance Full Stack Developer | React, Next.js, Azure`,
    template: `%s | ${personName}`,
  },
  description,
  keywords: keywords.join(', '),
  authors: [
    {
      name: personName,
      url: siteUrl,
    },
  ],
  creator: personName,
  publisher: personName,
  applicationName: `${personName} Portfolio`,
  category: 'Technology',
  classification: 'Portfolio',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: `${personName} - Full Stack Developer`,
    title: `${personName} — Freelance Full Stack Developer | React, Next.js, Azure`,
    description,
    locale: 'en_GB',
    images: [
      {
        url: profileImage,
        width: content.basicInfo?.image?.size?.width || 1200,
        height: content.basicInfo?.image?.size?.height || 630,
        alt: `${personName} - Full Stack Developer Portfolio`,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${personName} — Freelance Full Stack Developer`,
    description,
    images: [profileImage],
    creator: '@lewishadden',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

function JsonLd() {
  const email = content.basicInfo?.contactInfo?.find((c: any) => c.name === 'Email')?.value;
  const telephone = content.basicInfo?.contactInfo?.find((c: any) => c.name === 'Mobile')?.value;

  // Person Schema
  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${siteUrl}/#person`,
    name: personName,
    url: siteUrl,
    image: {
      '@type': 'ImageObject',
      url: new URL(profileImage, siteUrl).toString(),
      width: content.basicInfo?.image?.size?.width || 1200,
      height: content.basicInfo?.image?.size?.height || 630,
    },
    email,
    telephone,
    jobTitle: content.basicInfo?.titles || ['Full Stack Engineer'],
    worksFor: {
      '@type': 'Organization',
      name: 'Freelance',
    },
    alumniOf: 'IBM',
    knowsAbout: [
      'React',
      'Next.js',
      'TypeScript',
      'JavaScript',
      'Node.js',
      'Azure',
      'AWS',
      'Full Stack Development',
      'Frontend Development',
      'Backend Development',
      'Cloud Architecture',
    ],
    sameAs,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'GB',
    },
  };

  // WebSite Schema
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    url: siteUrl,
    name: `${personName} - Full Stack Developer Portfolio`,
    description,
    publisher: {
      '@id': `${siteUrl}/#person`,
    },
    inLanguage: 'en-GB',
  };

  // BreadcrumbList Schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'About',
        item: `${siteUrl}#about`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Experience',
        item: `${siteUrl}#experience`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: 'Projects',
        item: `${siteUrl}#projects`,
      },
      {
        '@type': 'ListItem',
        position: 5,
        name: 'Skills',
        item: `${siteUrl}#skills`,
      },
      {
        '@type': 'ListItem',
        position: 6,
        name: 'Contact',
        item: `${siteUrl}#contact`,
      },
    ],
  };

  // ProfilePage Schema
  const profilePageSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@id': `${siteUrl}/#person`,
    },
    url: siteUrl,
    name: `${personName} - Professional Portfolio`,
    description,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profilePageSchema) }}
      />
    </>
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
