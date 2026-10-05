import { expect, openHydrated, test } from './fixtures';

import type { Page } from '@playwright/test';

const openPalette = async (page: Page) => {
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole('combobox', { name: 'Command' });
  await expect(input).toBeFocused();
  return { dialog, input };
};

test.describe('command palette', () => {
  test('opens with Ctrl/⌘+K and jumps to a page', async ({ page }) => {
    await openHydrated(page, '/');
    const { dialog, input } = await openPalette(page);
    await input.fill('skills');
    await expect(dialog.getByRole('option').first()).toContainText('Skills');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/skills$/);
    await expect(dialog).toBeHidden();
  });

  test('opens a project page', async ({ page }) => {
    await openHydrated(page, '/about');
    const { dialog, input } = await openPalette(page);
    await input.fill('drive');
    await dialog.getByRole('option', { name: 'Drive King' }).click();
    await expect(page).toHaveURL(/\/projects\/drive-king$/);
  });

  test('the header button opens it and Escape hands focus back', async ({ page }) => {
    await openHydrated(page, '/experience');
    const button = page.getByRole('button', { name: 'Open command palette' });
    await button.click();
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await expect(dialog).toBeVisible();

    // Arrow keys move the active option
    const input = dialog.getByRole('combobox', { name: 'Command' });
    const first = dialog.getByRole('option').first();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await input.press('ArrowDown');
    await expect(first).toHaveAttribute('aria-selected', 'false');
    await expect(dialog.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('runs terminal commands', async ({ page }) => {
    await openHydrated(page, '/');
    const { dialog, input } = await openPalette(page);
    const log = dialog.getByRole('log');

    await input.fill('whoami');
    await expect(dialog.getByRole('option').first()).toContainText('Run “whoami”');
    await page.keyboard.press('Enter');
    await expect(log).toContainText('senior full stack engineer');
    await expect(input).toHaveValue('');

    await input.fill('rm -rf /');
    await page.keyboard.press('Enter');
    await expect(log).toContainText('Nice try.');

    await input.fill('cd contact');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/contact$/);
    await expect(dialog).toBeHidden();
  });
});

test('stats for nerds shows live frame timings', async ({ page }) => {
  await openHydrated(page, '/');
  const { dialog, input } = await openPalette(page);
  await input.fill('nerds');
  await dialog.getByRole('option', { name: /Stats for nerds/ }).click();
  await expect(dialog).toBeHidden();

  const stats = page.getByRole('complementary', { name: 'Rendering statistics' });
  await expect(stats).toBeVisible();
  await expect(stats.locator('b')).toHaveText(/^\d+$/);
  await expect(stats).toContainText(/frame\s+[\d.]+ ms/);
  await expect(stats).toContainText(/world\s+off/);

  // Alt+Shift+S toggles it from anywhere
  await page.keyboard.press('Alt+Shift+KeyS');
  await expect(stats).toBeHidden();
  await page.keyboard.press('Alt+Shift+KeyS');
  await expect(stats).toBeVisible();
  await stats.getByRole('button', { name: 'Close statistics' }).click();
  await expect(stats).toBeHidden();
});
