import './globals.scss';
import './theme-variables.scss';
import './page.scss';

import localFont from 'next/font/local';

import { ClientProviders } from '@/components/ClientProviders/ClientProviders';
import { PageTransition } from '@/components/PageTransition/PageTransition';
import { GoogleAnalyticsDeferred } from '@/components/GoogleAnalyticsDeferred/GoogleAnalyticsDeferred';
import { ThemeScript } from '@/components/ThemeScript/ThemeScript';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { World } from '@/components/World/World';
import { Cursor } from '@/components/Cursor/Cursor';
import { ScrollProgress } from '@/components/ScrollProgress/ScrollProgress';

import type { Metadata, Viewport } from 'next';

import content from '../content/content.json';
import { siteUrl, personName, siteDescription as description } from 'utils/seo';
import { ContactInfo, Social } from '@/types';

import type { WorldContent } from '@/components/World/types';

// Self-hosted (app/_fonts, see its README) rather than next/font/google: builds
// then never depend on Google Fonts, whose responses can break Turbopack's font
// loader (vercel/next.js#99114). Each file is one variable font.
const unbounded = localFont({
  src: './_fonts/Unbounded-Variable.woff2',
  weight: '400 800',
  variable: '--font-unbounded',
  display: 'swap',
});

const geist = localFont({
  src: './_fonts/Geist-Variable.woff2',
  weight: '400 800',
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = localFont({
  src: './_fonts/GeistMono-Variable.woff2',
  weight: '400 600',
  variable: '--font-geist-mono',
  display: 'swap',
});

// Serialisable slice of content.json the 3D world needs (project screens, skill badges)
const worldContent: WorldContent = {
  projects: content.projects.items.map((p) => ({
    title: p.title,
    slug: p.slug,
    image: p.images[0]?.url,
  })),
  skills: content.skills.icons.map((s) => ({ name: s.name, icon: s.class, category: s.category })),
  categories: content.skills.categories.map((c) => c.categoryKey),
  experienceCount: content.experience.items.length,
};

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
      data-theme="dark"
      suppressHydrationWarning
      className={`${unbounded.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body suppressHydrationWarning>
        <ClientProviders>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <World content={worldContent} />
          <ScrollProgress />
          <Header
            header={content.header}
            navItems={content.global.navItems}
            available={content.global.openToWork}
          />
          <main id="main-content">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer footer={content.footer} navItems={content.global.navItems} />
          <Cursor />
        </ClientProviders>
        <JsonLd />
        <GoogleAnalyticsDeferred gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || ''} />
      </body>
    </html>
  );
}
