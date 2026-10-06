import { expect, openHydrated, test } from './fixtures';

test('with 3D effects off the header is the flat bar', async ({ page }) => {
  await openHydrated(page, '/about');
  await expect(page.locator('header.header')).not.toHaveClass(/header--glass/);
  await expect(page.locator('.header-glass')).toHaveCount(0);
});

test('the header stays in view as the page scrolls', async ({ page }) => {
  await openHydrated(page, '/about');
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(600);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeInViewport();
});

test.describe('the header as a slab of glass', () => {
  test.use({ world: 'on', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });

  test(
    'draws the slab behind real links, which still navigate',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/about');
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 120_000 });
      await expect(page.locator('header.header')).toHaveClass(/header--glass/);
      await expect(page.locator('.header-glass')).toHaveAttribute('data-shown', {
        timeout: 30_000,
      });

      const nav = page.getByRole('navigation', { name: 'Main navigation' });
      await expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute(
        'aria-current',
        'page'
      );
      await nav.getByRole('link', { name: 'Skills' }).click();
      await expect(page).toHaveURL(/\/skills$/);
      await expect(nav.getByRole('link', { name: 'Skills' })).toHaveAttribute(
        'aria-current',
        'page'
      );
    }
  );
});
