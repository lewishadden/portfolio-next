import './globals.scss';
import './theme-variables.scss';
import './page.scss';

import { JetBrains_Mono, Fraunces, Instrument_Sans } from 'next/font/google';

import { ClientProviders } from '@/components/ClientProviders/ClientProviders';
import { PageTransition } from '@/components/PageTransition/PageTransition';
import { GoogleAnalyticsDeferred } from '@/components/GoogleAnalyticsDeferred/GoogleAnalyticsDeferred';
import { ThemeScript } from '@/components/ThemeScript/ThemeScript';
import { Grain } from '@/components/Grain/Grain';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { Background } from '@/components/Background/Background';
import { ScrollProgress } from '@/components/ScrollProgress/ScrollProgress';
import { RevealMount } from '@/components/RevealMount/RevealMount';

import type { Metadata, Viewport } from 'next';

import content from '../content/content.json';
import { siteUrl, personName, siteDescription as description } from 'utils/seo';
import { ContactInfo, Social } from '@/types';

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-fraunces',
  display: 'swap',
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-sans',
  display: 'swap',
});

const profileImage = content.about?.image?.url || '/static/images/bio-pic.jpeg';
const sameAs = (content.footer?.social || []).map((s: Social) => s.url).filter(Boolean);

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `Freelance React & Next.js Developer UK | ${personName}`,
    template: `%s | ${personName}`,
  },
  description,
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
  // og:image / twitter:image come from the app/opengraph-image.tsx file convention
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: `${personName} - Full Stack Developer`,
    title: `Freelance React & Next.js Developer UK | ${personName}`,
    description,
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${personName} — Freelance Full Stack Developer`,
    description,
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
      name: 'IBM',
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
      addressLocality: 'Peterborough',
      addressRegion: 'Cambridgeshire',
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

  // ProfilePage schema lives on the home page only (app/page.tsx)
  return (
    <>
      {[personSchema, websiteSchema].map((schema, i) => (
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
    <html
      lang="en-GB"
      suppressHydrationWarning
      className={`${fraunces.variable} ${instrumentSans.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body data-theme="dark" suppressHydrationWarning>
        <ClientProviders>
          <RevealMount />
          <ScrollProgress />
          <Header header={content.header} navItems={content.global.navItems} />
          <main id="main-content">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer footer={content.footer} navItems={content.global.navItems} />
          <Background />
          <Grain />
        </ClientProviders>
        <JsonLd />
        <GoogleAnalyticsDeferred gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || ''} />
      </body>
    </html>
  );
}
