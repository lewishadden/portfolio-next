import { siteUrl, personName } from 'utils/seo';

type PageJsonLdProps = {
  /** Route path, e.g. "/about" */
  path: string;
  /** Human-readable page name used in WebPage and breadcrumb */
  name: string;
  description: string;
  /** schema.org WebPage subtype */
  type?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage';
};

export function PageJsonLd({ path, name, description, type = 'WebPage' }: PageJsonLdProps) {
  const pageUrl = `${siteUrl}${path}`;

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': type,
        '@id': `${pageUrl}/#webpage`,
        url: pageUrl,
        name,
        description,
        inLanguage: 'en-GB',
        isPartOf: { '@id': `${siteUrl}/#website` },
        about: { '@id': `${siteUrl}/#person` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}/#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: personName, item: siteUrl },
          { '@type': 'ListItem', position: 2, name, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
