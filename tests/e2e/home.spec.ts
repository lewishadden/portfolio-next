import { expect, openHydrated, test } from './fixtures';

import type { Page } from '@playwright/test';

const saveMotion = (page: Page, level: string) =>
  page.addInitScript((saved) => {
    try {
      localStorage.setItem('motion', saved);
    } catch {
      // storage blocked: the OS setting decides
    }
  }, level);

test.describe('key stats', () => {
  test('never read out a count on its way up', async ({ page }) => {
    await openHydrated(page, '/');
    const stats = page.getByRole('region', { name: 'Key stats' });
    // Hydrated, the count not started yet: the real numbers, never "0+"
    const before = await stats.ariaSnapshot();
    expect(before).not.toMatch(/\b0\+/);
    expect(before).toMatch(/\b\d+\+/);

    // While the digits count up on screen, screen readers keep the real numbers
    const values = stats.locator('.stats__value .text-gradient');
    await stats.scrollIntoViewIfNeeded();
    for (let i = 0; i < 8; i += 1) {
      expect(await stats.ariaSnapshot()).toBe(before);
      await page.waitForTimeout(150);
    }
    // And the count ends on them
    await expect(values.first()).toHaveText(
      (await stats.locator('.stats__value .sr-only').first().textContent()) ?? ''
    );
  });

  for (const level of ['calm', 'still']) {
    test(`show the real numbers straight away at ${level}`, async ({ page }) => {
      await saveMotion(page, level);
      await openHydrated(page, '/');
      const stats = page.getByRole('region', { name: 'Key stats' });
      await stats.scrollIntoViewIfNeeded();
      const shown = await stats
        .locator('.stats__value')
        .evaluateAll((cells) =>
          cells.map((cell) => [
            cell.querySelector('.text-gradient')?.textContent,
            cell.querySelector('.sr-only')?.textContent,
          ])
        );
      expect(shown.length).toBeGreaterThan(0);
      for (const [digits, value] of shown) expect(digits).toBe(value);
    });
  }
});
