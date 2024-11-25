/** @type {import('next-sitemap').IConfig} */
export default {
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  generateRobotsTxt: true, // (optional)
  changefreq: 'weekly',
  generateIndexSitemap: false,
  outDir: 'out',
};
