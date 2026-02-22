/** @type {import('next-sitemap').IConfig} */
export default {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://portfolio.lewishadden.com',
  generateRobotsTxt: false,
  changefreq: 'monthly',
  priority: 1.0,
  generateIndexSitemap: false,
  outDir: 'public',
  exclude: ['/server-sitemap.xml'],
  transform: async (config, path) => {
    // Custom priority and changefreq based on path
    if (path === '/') {
      return {
        loc: path,
        changefreq: 'weekly',
        priority: 1.0,
        lastmod: new Date().toISOString(),
      };
    }

    return {
      loc: path,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod: new Date().toISOString(),
    };
  },
};
