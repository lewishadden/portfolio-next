import { expect, openHydrated, test } from './fixtures';

import type { Page } from '@playwright/test';

/**
 * Without storage the saved "3D off" can't be read, so the world would start:
 * take WebGL away too, as the world isn't what these tests are about
 */
async function withoutWebGL(page: Page) {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type.includes('webgl')) return null;
        return (getContext as (...args: unknown[]) => unknown).call(this, type, ...rest);
      },
    });
  });
}

// Browsers block storage in two ways: Chrome's "block all site data" makes
// the localStorage getter itself throw; others throw from each call
const blockers = {
  'each storage call throws': () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    Storage.prototype.getItem = blocked;
    Storage.prototype.setItem = blocked;
    Storage.prototype.removeItem = blocked;
  },
  'reading localStorage throws': () => {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          throw new DOMException('Access is denied for this document.', 'SecurityError');
        },
      });
    }
  },
};

test.describe('with storage blocked', () => {
  for (const [name, block] of Object.entries(blockers)) {
    test(`the site still works when ${name}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await withoutWebGL(page);
      await page.addInitScript(block);

      await openHydrated(page, '/');
      await expect(page.getByRole('heading', { level: 1, name: 'Lewis Hadden' })).toBeVisible();

      // The choice can't be saved, but it still applies
      const html = page.locator('html');
      const before = await html.getAttribute('data-theme');
      const next = before === 'light' ? 'dark' : 'light';
      await page.getByRole('switch', { name: `Switch to ${next} mode` }).click();
      await expect(html).toHaveAttribute('data-theme', next);
      await expect(page.getByRole('switch', { name: `Switch to ${before} mode` })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
