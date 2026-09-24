// IndexNow submission for portfolio.lewishadden.com
//
// Notifies IndexNow-participating search engines (Bing, Yandex, Seznam, …) that
// URLs have changed so they recrawl sooner. Ownership is proved by the key file
// served at https://portfolio.lewishadden.com/<key>.txt.
//
// Usage:
//   node scripts/indexnow.mjs              # submit every URL in the sitemap
//   node scripts/indexnow.mjs <url> [...]  # submit specific URLs
//
// Requires Node 18+ (global fetch). Run after a production deploy.

const HOST = 'portfolio.lewishadden.com';
const KEY = 'f01e788253de41b49344920789ed78b3';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

async function sitemapUrls() {
  const res = await fetch(`https://${HOST}/sitemap.xml`);
  if (!res.ok) {
    throw new Error(`Could not fetch sitemap (${res.status} ${res.statusText})`);
  }
  const xml = await res.text();
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

const args = process.argv.slice(2);
const urlList = args.length > 0 ? args : await sitemapUrls();

if (urlList.length === 0) {
  console.error('No URLs to submit.');
  process.exit(1);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  }),
});

console.log(`IndexNow: ${res.status} ${res.statusText} — submitted ${urlList.length} URL(s)`);

if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}
