import { expect, test } from './fixtures';

test('the About page quotes the LinkedIn recommendation', async ({ page }) => {
  await page.goto('/about');
  const section = page.getByRole('region', { name: 'In their words' });
  await expect(section.locator('blockquote')).toContainText('fast-moving initiative');
  await expect(section).toContainText('Alexander Romero');
  await expect(section.locator('time')).toHaveAttribute('datetime', '2026-07-08');
  await expect(section.getByRole('link', { name: /View on LinkedIn/ })).toHaveAttribute(
    'href',
    /linkedin\.com/
  );
});
