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

test.describe('the palette and the world', () => {
  test('page rows say where each page is docked, and the selection starts on another page', async ({
    page,
  }) => {
    await openHydrated(page, '/');
    const { dialog } = await openPalette(page);
    // Browsing, the pages come first, in nav order
    const home = dialog.getByRole('option').nth(0);
    await expect(home).toContainText('Home');
    await expect(home).toContainText('Docked');
    await expect(home).toHaveAttribute('aria-selected', 'false');
    const about = dialog.getByRole('option').nth(1);
    await expect(about).toContainText(/Crew habitat · \d+ km/);
    await expect(about).toHaveAttribute('aria-selected', 'true');
  });

  test('on a project page the Projects row reads docked, not 0 km', async ({ page }) => {
    await openHydrated(page, '/projects/drive-king');
    const { dialog } = await openPalette(page);
    const projects = dialog.getByRole('option', { name: /^Projects\b/ });
    await expect(projects).toContainText('Docked');
    await expect(projects).not.toContainText('0 km');
    // Still the way back to the list
    await projects.click();
    await expect(page).toHaveURL(/\/projects$/);
  });

  test('a wheel over the open palette leaves the page where it was', async ({ page }) => {
    await openHydrated(page, '/experience');
    await page.mouse.move(40, 400);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(1200);
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);
    await openPalette(page);
    // Over the dimmed page beside the panel
    await page.mouse.move(12, 600);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('closing the palette mid "sudo hire lewis" stays on the page', async ({ page }) => {
    await openHydrated(page, '/about');
    let { dialog, input } = await openPalette(page);
    await input.fill('sudo hire lewis');
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('log')).toContainText('password for recruiter');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.waitForTimeout(5000);
    await expect(page).toHaveURL(/\/about$/);
    ({ dialog, input } = await openPalette(page));
    await expect(dialog.getByRole('log')).toContainText('^C');
    await expect(dialog.getByRole('log')).not.toContainText('Launch sequence armed');
  });

  test('closing the palette with Ctrl/⌘+K mid "sudo hire lewis" stays on the page too', async ({
    page,
  }) => {
    await openHydrated(page, '/about');
    let { dialog, input } = await openPalette(page);
    await input.fill('sudo hire lewis');
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('log')).toContainText('password for recruiter');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog).toBeHidden();
    await page.waitForTimeout(5000);
    await expect(page).toHaveURL(/\/about$/);
    ({ dialog, input } = await openPalette(page));
    await expect(dialog.getByRole('log')).toContainText('^C');
    await expect(dialog.getByRole('log')).not.toContainText('Launch sequence armed');
  });

  test('a page chosen from the palette has focus on its heading once it shows', async ({
    page,
  }) => {
    await openHydrated(page, '/');
    const { dialog, input } = await openPalette(page);
    await input.fill('experience');
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/experience$/);
    await expect(page.locator('#main-content h1')).toBeFocused();
  });
});

test.describe('the palette in free roam', () => {
  test.use({ world: 'on', reducedMotion: 'reduce' });

  test(
    'choosing a page from free roam leaves explore mode',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
      const html = page.locator('html');

      let { input } = await openPalette(page);
      await input.fill('free flight');
      await page.keyboard.press('Enter');
      await expect(html).toHaveAttribute('data-world-mode', 'explore');
      await page.evaluate(() => document.exitPointerLock());

      ({ input } = await openPalette(page));
      await input.fill('skills');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/skills$/);
      await expect(html).toHaveAttribute('data-world-mode', 'page', { timeout: 20_000 });
      await expect(page.locator('#main-content')).not.toHaveAttribute('inert');
    }
  );
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
