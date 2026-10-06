import { expect, openHydrated, test } from './fixtures';

test.describe('mobile menu', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens under the header, links every page and closes with Escape or a link', async ({
    page,
  }) => {
    await openHydrated(page, '/about');
    const menu = page.locator('#mobile-menu');
    await expect(menu).toBeHidden();

    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const close = page.getByRole('button', { name: 'Close navigation menu' });
    await expect(close).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link')).toHaveCount(6);
    await expect(menu.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
    // The header stays on top, every control in reach
    await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible();
    await expect(close).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await menu.getByRole('link', { name: 'Skills' }).click();
    await expect(page).toHaveURL(/\/skills$/);
    await expect(menu).toBeHidden();
  });

  test.describe('with 3D effects on', () => {
    test.use({ world: 'on' });

    test('warps in over a starfield', { tag: '@webgl' }, async ({ page }) => {
      await openHydrated(page, '/about');
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 120_000 });
      const warp = page.locator('.mobile-menu__warp');
      // No WebGL context until the menu first opens
      await expect(warp).not.toHaveAttribute('data-live');
      await page.getByRole('button', { name: 'Open navigation menu' }).click();
      await expect(warp).toHaveAttribute('data-live', '');
      await expect(warp).toBeVisible();
    });
  });
});
