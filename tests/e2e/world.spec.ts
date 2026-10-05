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

test.describe('tour and explore modes', () => {
  test.use({ world: 'on', reducedMotion: 'reduce' });

  test('take over the page and hand it back', { tag: '@webgl' }, async ({ page }) => {
    await openHydrated(page, '/');
    await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
    const main = page.locator('#main-content');

    // The guided tour hides the page while it flies station to station. The
    // pointer rests where its caption card appears, which holds the tour at
    // each stop: software WebGL makes every action slow, and the tour moves
    // on by itself in real time
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height - 120);
    await page.getByRole('button', { name: 'Take the tour' }).focus();
    await page.keyboard.press('Enter');
    const tour = page.getByRole('region', { name: 'Guided tour' });
    await expect(tour).toBeVisible();
    await expect(tour).toContainText('01 / 06');
    await expect(main).toHaveAttribute('inert', '');
    await expect(page.locator('html')).toHaveAttribute('data-world-mode', 'tour');

    await tour.getByRole('button', { name: 'Next stop' }).click();
    await expect(tour).toContainText('02 / 06');
    await tour.getByRole('button', { name: 'Visit About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(tour).toBeHidden();
    await expect(main).not.toHaveAttribute('inert');

    // Free flight from the command palette; Escape lands back on the page
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await palette.getByRole('combobox', { name: 'Command' }).fill('free flight');
    await page.keyboard.press('Enter');
    const hud = page.getByRole('region', { name: 'Explore mode' });
    await expect(hud).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-world-mode', 'explore');
    await expect(main).toHaveAttribute('inert', '');

    await page.keyboard.press('Escape');
    await expect(hud).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-world-mode', 'page');
    await expect(main).not.toHaveAttribute('inert');
    await expect(page).toHaveURL(/\/about$/);

    // The floating button toggles free roam too
    await page.getByRole('button', { name: 'Free roam' }).click();
    await expect(hud).toBeVisible();
    await page.getByRole('button', { name: 'Exit free roam' }).click();
    await expect(hud).toBeHidden();
    await expect(main).not.toHaveAttribute('inert');
  });
});
