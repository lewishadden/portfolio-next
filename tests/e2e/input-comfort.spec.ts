import { expect, openHydrated, test } from './fixtures';

test.describe('flight input ownership', () => {
  test.use({ world: 'on', reducedMotion: 'reduce' });

  test(
    'denied pointer lock keeps steering usable and controls own their shortcuts',
    { tag: '@webgl' },
    async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(HTMLElement.prototype, 'requestPointerLock', {
          configurable: true,
          value() {
            const root = document.documentElement;
            root.dataset.lockRequests = String(Number(root.dataset.lockRequests ?? 0) + 1);
            return Promise.reject(new DOMException('Pointer lock denied', 'NotAllowedError'));
          },
        });
      });
      await openHydrated(page, '/');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
      await page.getByRole('button', { name: 'Free roam', exact: true }).click();
      const hud = page.getByRole('region', { name: 'Explore mode' });
      await expect(hud).toBeVisible();
      await expect(hud).toContainText('mouse steers');
      await expect(page.locator('html')).toHaveAttribute('data-lock-requests', '1');

      // Movement must continue under demand rendering after a rejected lock.
      const marker = hud.locator('[data-station="projects"]');
      const before = await marker.evaluate((element) => element.style.transform);
      await page.evaluate(() => {
        window.dispatchEvent(
          new PointerEvent('pointermove', {
            pointerType: 'mouse',
            clientX: innerWidth * 0.8,
            clientY: innerHeight / 2,
            movementX: 8,
          })
        );
      });
      await expect
        .poll(() => marker.evaluate((element) => element.style.transform))
        .not.toBe(before);

      await page.evaluate(() => {
        window.dispatchEvent(
          new PointerEvent('pointermove', {
            pointerType: 'mouse',
            clientX: innerWidth / 2,
            clientY: innerHeight / 2,
          })
        );
      });
      await hud.focus();
      await page.keyboard.press('Digit0');
      await expect(hud.getByRole('button', { name: /^Dock at Home/ })).toBeVisible({
        timeout: 60_000,
      });
      const home = hud.locator('[data-station="home"]');
      await expect(home).toBeDisabled();
      await expect(home).toHaveAttribute('tabindex', '-1');

      // Near a station, Enter must activate the focused Exit, without docking.
      const exit = hud.getByRole('button', { name: /^Exit/ });
      await exit.focus();
      await page.keyboard.press('Digit3');
      await expect(marker).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('Enter');
      await expect(hud).toBeHidden();
      await expect(page.locator('html')).toHaveAttribute('data-world-mode', 'page');

      // Re-entering and clicking controls never retries a rejected request.
      await page.getByRole('button', { name: 'Free roam', exact: true }).click();
      await expect(hud).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-lock-requests', '1');
      await page.keyboard.press('ControlOrMeta+k');
      const palette = page.getByRole('dialog', { name: 'Command palette' });
      await expect(palette).toBeVisible();
      await palette.getByRole('combobox', { name: 'Command' }).fill('3');
      await expect(marker).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('Escape');
      await expect(palette).toBeHidden();
      await expect(hud).toBeVisible();

      // Every unavailable marker is disabled and excluded from keyboard focus.
      const unavailable = hud.locator('.waypoint[aria-hidden="true"]');
      for (const button of await unavailable.all()) {
        await expect(button).toBeDisabled();
        await expect(button).toHaveAttribute('tabindex', '-1');
      }
      await hud.getByRole('button', { name: /^Exit/ }).click();
    }
  );
});
