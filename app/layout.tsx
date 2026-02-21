import './globals.scss';
import './theme-variables.scss';
import { ThemeProvider } from 'contexts/ThemeContext';
import { GoogleAnalyticsDeferred } from 'components/GoogleAnalyticsDeferred/GoogleAnalyticsDeferred';
import { ThemeScript } from 'components/ThemeScript/ThemeScript';
import type { Metadata, Viewport } from 'next';

import content from '../content/content.json';
import { ContactInfo, Social } from '@/types';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://portfolio.lewishadden.com';

const personName = content.home?.name || 'Portfolio';
const description =
  'Lewis Hadden - Senior Full Stack Engineer specializing in React, Next.js, TypeScript, Node.js & Azure. 8+ years experience. Available for contracts.';
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
const profileImage = content.about?.image?.url || '/static/images/portrait.png';
const sameAs = (content.footer?.social || []).map((s: Social) => s.url).filter(Boolean);

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
        width: content.about?.image?.size?.width || 1200,
        height: content.about?.image?.size?.height || 630,
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
    apple: '/static/images/favicon.png',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

function JsonLd() {
  const email = content.contact?.contactInfo?.items?.find(
    (c: ContactInfo) => c.name === 'Email'
  )?.value;
  const telephone = content.contact?.contactInfo?.items?.find(
    (c: ContactInfo) => c.name === 'Mobile'
  )?.value;

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
      width: content.about?.image?.size?.width || 1200,
      height: content.about?.image?.size?.height || 630,
    },
    email,
    telephone,
    description,
    jobTitle: content.home?.titles?.[0] || 'Full Stack Engineer',
    worksFor: {
      '@type': 'Organization',
      name: 'Freelance',
    },
    alumniOf: {
      '@type': 'Organization',
      name: 'ADP',
    },
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
    dateCreated: '2020-01-01',
    dateModified: new Date().toISOString().split('T')[0],
  };

  return (
    <>
      {[personSchema, websiteSchema, profilePageSchema].map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="dns-prefetch" href="https://api.iconify.design" />
        <link rel="preconnect" href="https://api.iconify.design" crossOrigin="anonymous" />
      </head>
      <body data-theme="dark" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
        <JsonLd />
        <GoogleAnalyticsDeferred gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || ''} />
      </body>
    </html>
  );
}
