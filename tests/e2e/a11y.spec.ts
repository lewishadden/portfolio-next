import AxeBuilder from '@axe-core/playwright';

import { expect, revealAll, routes, test } from './fixtures';

const pages = [...routes, '/projects/drive-king', '/this-page-does-not-exist'];
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

for (const theme of ['dark', 'light'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ theme, reducedMotion: 'reduce' });

    for (const path of pages) {
      test(`${path} has no WCAG 2.1 A/AA violations`, async ({ page }) => {
        await page.goto(path);
        await revealAll(page);
        const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
        const summary = violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`
        );
        expect(summary).toEqual([]);
      });
    }

    test('the project dialog has no WCAG 2.1 A/AA violations', async ({ page }) => {
      await page.goto('/projects');
      await page.getByRole('link', { name: 'View details for Drive King' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(1200);
      const { violations } = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(tags)
        .analyze();
      expect(violations.map((v) => v.id)).toEqual([]);
    });
  });
}
