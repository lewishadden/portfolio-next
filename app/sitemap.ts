import { MetadataRoute } from 'next';

import { siteUrl, contentUpdated } from 'utils/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  // Real content-change date (content.json global.contentUpdated), not the build time —
  // Google ignores lastmod once it detects inaccurate values.
  const lastModified = new Date(contentUpdated);

  const routes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  }> = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/experience', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/projects', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/skills', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.8, changeFrequency: 'yearly' },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${siteUrl}${path === '/' ? '' : path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
