import { expect, openHydrated, test } from './fixtures';

test('with 3D effects off the header is the flat bar', async ({ page }) => {
  await openHydrated(page, '/about');
  const header = page.locator('header.header');
  await expect(header).not.toHaveClass(/header--hud/);
  await expect(page.locator('.header-hud')).toHaveCount(0);
});

test.describe('the header as a cockpit HUD', () => {
  test.use({ world: 'on', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });

  test(
    'draws the hologram behind real links, which still navigate',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/about');
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 120_000 });
      const header = page.locator('header.header');
      await expect(header).toHaveClass(/header--hud/);
      await expect(page.locator('.header-hud')).toBeAttached();
      // Reduced motion holds it still
      await expect
        .poll(() =>
          page.locator('.header__bar').evaluate((el) => (el as HTMLElement).style.transform)
        )
        .toBe('');

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
