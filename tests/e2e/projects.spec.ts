import { expect, openHydrated, test } from './fixtures';

import type { Page } from '@playwright/test';

/** Brings a project to the front (the index link), where its "View details" lives */
async function pick(page: Page, name: string) {
  const index = page.getByRole('navigation', { name: 'Projects' });
  await index.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
}

test.describe('project modal', () => {
  test('opens at the project URL and closes back to the list', async ({ page }) => {
    await openHydrated(page, '/projects');
    await pick(page, 'Drive King');
    const card = page.getByRole('link', { name: 'View details for Drive King' });
    await expect(card).toHaveAttribute('href', '/projects/drive-king');

    await card.click();
    await expect(page).toHaveURL(/\/projects\/drive-king$/);
    const dialog = page.getByRole('dialog', { name: 'Drive King' });
    await expect(dialog).toBeVisible();
    // The project steps stay mounted underneath: no navigation happened
    await expect(page.getByRole('heading', { level: 1, name: 'Selected projects' })).toBeAttached();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(card).toBeFocused();
  });

  test('the Back button closes it and Forward reopens it', async ({ page }) => {
    await openHydrated(page, '/projects');
    await pick(page, 'Sidenote');
    await page.getByRole('link', { name: 'View details for Sidenote' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sidenote' });
    await expect(dialog).toBeVisible();

    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects$/);

    await page.goForward();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/projects\/sidenote$/);
  });

  test('keeps the scroll position', async ({ page }) => {
    await openHydrated(page, '/projects');
    await pick(page, 'Audex');
    const card = page.getByRole('link', { name: 'View details for Audex' });
    const scrollY = () => page.evaluate(() => Math.round(window.scrollY));

    // Where the visitor left the list: scroll the card into view and let the
    // smooth scrolling (CSS + Lenis) settle before clicking
    await card.scrollIntoViewIfNeeded();
    let settled = -1;
    await expect
      .poll(async () => {
        const start = await scrollY();
        await page.waitForTimeout(250);
        settled = await scrollY();
        return settled === start;
      })
      .toBe(true);
    expect(settled).toBeGreaterThan(0);

    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close project details' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    // The dialog pins the page while open, snapping back anything that scrolls it
    await expect.poll(scrollY).toBe(settled);
  });
});

test.describe('project index', () => {
  test('picks the project in front, and every project keeps its own link', async ({ page }) => {
    await openHydrated(page, '/projects');
    const index = page.getByRole('navigation', { name: 'Projects' });
    const links = index.getByRole('link');
    await expect(links.first()).toHaveAttribute('aria-current', 'true');
    await expect(links.first()).toHaveAttribute('href', /^\/projects\/[\w-]+$/);

    const sidenote = index.getByRole('link', { name: 'Sidenote', exact: true });
    await sidenote.click();
    await expect(sidenote).toHaveAttribute('aria-current', 'true');
    await expect(links.first()).not.toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('heading', { level: 2, name: 'Sidenote' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View details for Sidenote' })).toBeVisible();

    // One crawlable link per project
    const count = await links.count();
    expect(count).toBeGreaterThan(5);
    const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(new Set(hrefs).size).toBe(count);
  });
});

test.describe('project pages', () => {
  test('render on a direct visit with breadcrumbs and neighbours', async ({ page }) => {
    const response = await page.goto('/projects/drive-king');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Drive King');
    await expect(page).toHaveTitle(/Drive King/);

    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/projects'
    );
    await expect(page.locator('a[rel="prev"]')).toHaveAttribute('href', '/projects/sidenote');
    const next = page.locator('a[rel="next"]');
    await expect(next).toHaveAttribute('href', '/projects/smiley-pets');

    await next.click();
    await expect(page).toHaveURL(/\/projects\/smiley-pets$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Smiley Pets');
  });

  test('describe the project in JSON-LD', async ({ page }) => {
    await page.goto('/projects/drive-king');
    const graphs = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) => scripts.map((s) => JSON.parse(s.textContent || '{}')));
    const nodes = graphs.flatMap((g) => g['@graph'] ?? [g]);
    const work = nodes.find((n) => n['@type'] === 'CreativeWork');
    expect(work?.name).toBe('Drive King');
    const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList');
    expect(crumbs?.itemListElement).toHaveLength(3);
  });

  test('unknown slugs are a 404', async ({ page }) => {
    const response = await page.goto('/projects/not-a-real-project');
    expect(response?.status()).toBe(404);
  });
});

test.describe('full-page screenshots', () => {
  test('show in a browser frame that scrolls itself and by hand', async ({ page }) => {
    await openHydrated(page, '/projects/drive-king');
    const gallery = page.getByRole('region', { name: 'Drive King screenshots' });
    await gallery.getByRole('button', { name: 'Next screenshot' }).click();

    const viewport = gallery.getByRole('region', { name: /Full-page screenshot/ });
    await expect(viewport).toBeVisible();
    await expect(gallery.locator('.page-shot__url')).toHaveText(/drive-king\.co\.uk/);
    // Wide, not a thin portrait strip
    const box = await viewport.boundingBox();
    expect(box && box.width > box.height).toBe(true);

    // Pans down on its own after a short pause
    const scrollTop = () => viewport.evaluate((el) => el.scrollTop);
    await expect.poll(scrollTop, { timeout: 8_000 }).toBeGreaterThan(100);

    // A wheel scroll hands control to the visitor
    await viewport.hover();
    await page.mouse.wheel(0, 600);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    const held = await scrollTop();
    await page.waitForTimeout(1500);
    expect(Math.abs((await scrollTop()) - held)).toBeLessThan(2);
  });
});
