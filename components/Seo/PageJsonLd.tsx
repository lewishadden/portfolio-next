import { siteUrl, personName } from 'utils/seo';

type PageJsonLdProps = {
  /** Route path, e.g. "/about" */
  path: string;
  /** Human-readable page name used in WebPage and breadcrumb */
  name: string;
  description: string;
  /** schema.org WebPage subtype */
  type?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage' | 'ItemPage';
  /** Breadcrumb levels between the home page and this one */
  parents?: { name: string; path: string }[];
  /** What the page is about (e.g. a project's CreativeWork), added to the graph; needs an '@id' */
  mainEntity?: Record<string, unknown>;
};

export function PageJsonLd({
  path,
  name,
  description,
  type = 'WebPage',
  parents = [],
  mainEntity,
}: PageJsonLdProps) {
  const pageUrl = `${siteUrl}${path}`;
  const trail = [
    { name: personName, item: siteUrl },
    ...parents.map((parent) => ({ name: parent.name, item: `${siteUrl}${parent.path}` })),
    { name, item: pageUrl },
  ];

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
        breadcrumb: { '@id': `${pageUrl}/#breadcrumb` },
        ...(mainEntity && { mainEntity: { '@id': mainEntity['@id'] } }),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}/#breadcrumb`,
        itemListElement: trail.map((level, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          ...level,
        })),
      },
      ...(mainEntity ? [mainEntity] : []),
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
