import { expect, openHydrated, test } from './fixtures';

test.describe('project grid modal', () => {
  test('opens at the project URL and closes back to the grid', async ({ page }) => {
    await openHydrated(page, '/projects');
    const card = page.getByRole('link', { name: 'View details for Drive King' });
    await expect(card).toHaveAttribute('href', '/projects/drive-king');

    await card.click();
    await expect(page).toHaveURL(/\/projects\/drive-king$/);
    const dialog = page.getByRole('dialog', { name: 'Drive King' });
    await expect(dialog).toBeVisible();
    // The grid stays mounted underneath — no navigation happened
    await expect(page.getByRole('heading', { level: 1, name: 'Selected projects' })).toBeAttached();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(card).toBeFocused();
  });

  test('the Back button closes it and Forward reopens it', async ({ page }) => {
    await openHydrated(page, '/projects');
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

  test('keeps the grid scroll position', async ({ page }) => {
    await openHydrated(page, '/projects');
    const card = page.getByRole('link', { name: 'View details for Audex' });
    const scrollY = () => page.evaluate(() => Math.round(window.scrollY));

    // Where the visitor left the grid: scroll the card into view and let the
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
