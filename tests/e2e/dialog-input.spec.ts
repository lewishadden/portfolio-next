import { expect, openHydrated, test } from './fixtures';

test('Escape closes the palette before the utility console underneath', async ({ page }) => {
  await openHydrated(page, '/');
  const trigger = page.getByRole('button', { name: 'Preferences', exact: true });
  await trigger.click();
  const preferences = page.getByRole('dialog', { name: 'Preferences', exact: true });
  await expect(preferences).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  const command = palette.getByRole('combobox', { name: 'Command' });
  await expect(command).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(command).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
  await expect(preferences).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preferences).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('palette keyboard input preserves the inspector underneath', async ({ page }) => {
  await openHydrated(page, '/about?inspect=station:about');
  const inspector = page.getByRole('dialog', { name: 'Crew dossier', exact: true });
  await expect(inspector).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  const command = palette.getByRole('combobox', { name: 'Command' });
  await expect(command).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(command).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Close inspection' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(inspector).toBeHidden();
  expect(new URL(page.url()).searchParams.has('inspect')).toBe(false);
});

test('dossier disclosures remain in the keyboard focus cycle', async ({ page }) => {
  await openHydrated(page, '/about?inspect=station:about');
  const inspector = page.getByRole('dialog', { name: 'Crew dossier', exact: true });
  await expect(inspector).toBeVisible();
  const summaries = inspector.locator('summary');
  expect(await summaries.count()).toBeGreaterThan(1);
  await summaries.first().focus();
  await page.keyboard.press('Space');
  await expect(inspector.locator('details').first()).toHaveAttribute('open', '');
  await page.keyboard.press('Tab');
  await expect(summaries.nth(1)).toBeFocused();
  await summaries.last().focus();
  await page.keyboard.press('Tab');
  await expect(inspector.getByRole('button', { name: 'Close inspection' })).toBeFocused();
});
