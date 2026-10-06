import { expect, openHydrated, test } from './fixtures';

test.describe('navigation menu as a list (3D effects off)', () => {
  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('opens under the header, links every page and closes with Escape or a link', async ({
      page,
    }) => {
      await openHydrated(page, '/about');
      const menu = page.locator('#nav-menu');
      await expect(menu).toBeHidden();

      await page.getByRole('button', { name: 'Open navigation menu' }).click();
      const close = page.getByRole('button', { name: 'Close navigation menu' });
      await expect(close).toHaveAttribute('aria-expanded', 'true');
      await expect(menu).toBeVisible();
      await expect(menu).not.toHaveAttribute('data-map');
      await expect(menu.getByRole('link')).toHaveCount(6);
      await expect(menu.getByRole('link', { name: 'About' })).toHaveAttribute(
        'aria-current',
        'page'
      );
      // The header stays on top, every control in reach
      await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible();
      await expect(close).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();

      // A list link goes straight there
      await page.getByRole('button', { name: 'Open navigation menu' }).click();
      await menu.getByRole('link', { name: 'Skills', exact: true }).click();
      await expect(page).toHaveURL(/\/skills$/);
      await expect(menu).toBeHidden();
    });
  });

  test.describe('on a desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('sits beside the header links, which close it as they navigate', async ({ page }) => {
      await openHydrated(page, '/about');
      const nav = page.getByRole('navigation', { name: 'Main navigation' });
      await nav.getByRole('button', { name: 'Open navigation menu' }).click();
      const menu = page.locator('#nav-menu');
      await expect(menu).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Projects' })).toBeVisible();

      await nav.getByRole('link', { name: 'Projects' }).click();
      await expect(page).toHaveURL(/\/projects$/);
      await expect(menu).toBeHidden();
    });
  });
});

test.describe('navigation menu as a star map', () => {
  // Reduced motion holds the orbit still, so the links over its worlds stay put
  test.use({ world: 'on', reducedMotion: 'reduce' });

  test.describe('with a mouse', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test(
      'pointing picks a station, clicking it flies there',
      { tag: '@webgl' },
      async ({ page }) => {
        await openHydrated(page, '/about');
        await page.waitForSelector('html:not([data-boot])', {
          state: 'attached',
          timeout: 120_000,
        });
        await page.getByRole('button', { name: 'Open navigation menu' }).click();
        const menu = page.locator('#nav-menu');
        await expect(menu).toHaveAttribute('data-map');
        await expect(menu.locator('.nav-menu__station[data-placed]')).toHaveCount(6, {
          timeout: 30_000,
        });

        const projects = menu.getByRole('link', { name: 'Projects', exact: true });
        await projects.hover();
        await expect(projects).toHaveAttribute('data-picked');
        await expect(menu.getByRole('link', { name: 'Fly to Projects' })).toBeVisible();
        await projects.click();
        await expect(page).toHaveURL(/\/projects$/);
        await expect(menu).toBeHidden();
      }
    );
  });

  test.describe('on a touch screen', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('a tap picks a station, a second tap flies there', { tag: '@webgl' }, async ({ page }) => {
      await openHydrated(page, '/about');
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 120_000 });
      await page.getByRole('button', { name: 'Open navigation menu' }).tap();
      const menu = page.locator('#nav-menu');
      await expect(menu.locator('.nav-menu__station[data-placed]')).toHaveCount(6, {
        timeout: 30_000,
      });

      const skills = menu.getByRole('link', { name: 'Skills', exact: true });
      await skills.tap();
      await expect(skills).toHaveAttribute('data-picked');
      await expect(menu.getByRole('link', { name: 'Fly to Skills' })).toBeVisible();
      await expect(page).toHaveURL(/\/about$/);

      await skills.tap();
      await expect(page).toHaveURL(/\/skills$/);
      await expect(menu).toBeHidden();
    });
  });
});
