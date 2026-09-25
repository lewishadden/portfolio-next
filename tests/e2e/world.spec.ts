import { expect, openHydrated, test } from './fixtures';

test.describe('without WebGL', () => {
  test.use({ world: 'on' });

  test('falls back to the 2D station renders', async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        value: function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
          if (type.includes('webgl')) return null;
          return (getContext as (...args: unknown[]) => unknown).call(this, type, ...rest);
        },
      });
    });
    await page.goto('/about');
    await expect(page.locator('html')).toHaveAttribute('data-world', 'off');
    await expect(page.locator('.station-fallback')).toBeVisible();
    await expect(page.getByRole('button', { name: '3D effects' })).toBeDisabled();
    await page.waitForTimeout(2500);
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});

test.describe('3D effects toggle', () => {
  // Reduced motion renders on demand, so software WebGL isn't redrawing all the time
  test.use({ world: 'on', reducedMotion: 'reduce' });

  // @webgl: runs in the chromium-webgl project, the only one with WebGL
  test(
    'switches the world off, and the choice survives a reload',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/about');
      const toggle = page.getByRole('button', { name: '3D effects' });
      await expect(page.locator('html')).toHaveAttribute('data-world', 'on');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.world canvas')).toHaveCount(1, { timeout: 20_000 });

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('html')).toHaveAttribute('data-world', 'off');
      await expect(page.locator('.world canvas')).toHaveCount(0);
      await expect(page.locator('.station-fallback')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('world'))).toBe('off');

      // Applied before hydration by ThemeScript, so there is no flash of the world
      await page.reload({ waitUntil: 'commit' });
      await page.waitForSelector('html[data-world]', { state: 'attached' });
      await expect(page.locator('html')).toHaveAttribute('data-world', 'off');

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('html')).toHaveAttribute('data-world', 'on');
      expect(await page.evaluate(() => localStorage.getItem('world'))).toBeNull();
    }
  );
});
