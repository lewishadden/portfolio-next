import { expect, routes, test } from './fixtures';

test('the sitemap lists every section and project page', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  for (const path of routes) expect(urls).toContain(path);
  expect(urls).toContain('/projects/drive-king');
  expect(urls.filter((p) => p.startsWith('/projects/')).length).toBeGreaterThan(10);
});

for (const path of [...routes, '/projects/drive-king']) {
  test(`${path} has its own Open Graph image`, async ({ page, request }) => {
    await page.goto(path);
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toBeTruthy();
    const imagePath = new URL(ogImage!).pathname;
    expect(imagePath).toBe(`${path === '/' ? '' : path}/opengraph-image`);

    const response = await request.get(imagePath);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  });
}

test('icons come from the offline bundle, never the Iconify API', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('iconify.design')) external.push(req.url());
  });
  const missing: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('Not in the offline bundle')) missing.push(msg.text());
  });
  for (const path of [...routes, '/projects/drive-king']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  expect(external).toEqual([]);
  expect(missing).toEqual([]);
});

test('the Person structured data carries the email and phone the contact page shows', async ({
  page,
}) => {
  await page.goto('/contact');
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const person = blocks
    .map((block) => JSON.parse(block) as Record<string, unknown>)
    .find((block) => block['@type'] === 'Person');
  expect(person).toBeTruthy();
  const main = page.locator('#main-content');
  await expect(main.locator(`a[href="mailto:${person!.email}"]`).first()).toBeAttached();
  expect(person!.telephone).toMatch(/^\+?[\d ]{9,}$/);
  await expect(main.getByText(person!.telephone as string).first()).toBeAttached();
});
