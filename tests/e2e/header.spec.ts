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

test.describe('the loading screen lifting into the header', () => {
  test.use({ world: 'on', viewport: { width: 1280, height: 800 } });

  for (const motion of ['full', 'calm'] as const) {
    test(`at ${motion} motion`, { tag: '@webgl' }, async ({ page }) => {
      await page.addInitScript((saved) => {
        try {
          localStorage.setItem('motion', saved);
        } catch {
          // storage blocked: the OS setting decides
        }
      }, motion);
      await openHydrated(page, '/');
      const root = page.locator('html');
      await expect(root).toHaveAttribute('data-boot', 'loading');
      const skip = page.getByRole('button', { name: 'Skip to the page' });
      await expect(skip).toBeVisible({ timeout: 10_000 });
      const logo = page.locator('.header__logo-mark');
      if (motion === 'full') {
        await skip.click();
        // The big mark flies into the logo slot; the header's own waits for it
        await expect(page.locator('.boot')).toHaveClass(/boot--docking/);
        await expect(logo).toBeHidden();
        await expect(root).not.toHaveAttribute('data-boot', { timeout: 5_000 });
        await expect(logo).toBeVisible();
      } else {
        // No lift to watch: the screen goes at once
        const gone = await skip.evaluate((button) => {
          (button as HTMLButtonElement).click();
          return new Promise<number>((resolve) => {
            const began = performance.now();
            const check = () => {
              if (!document.documentElement.hasAttribute('data-boot')) {
                resolve(performance.now() - began);
              } else requestAnimationFrame(check);
            };
            check();
          });
        });
        expect(gone).toBeLessThan(300);
        await expect(logo).toBeVisible();
      }
    });
  }
});
