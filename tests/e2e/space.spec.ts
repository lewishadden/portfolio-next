import { expect, openHydrated, routes, test } from './fixtures';

test('sound is off by default, and turning it on is remembered', async ({ page }) => {
  await openHydrated(page, '/');
  const sound = page.getByRole('button', { name: 'Sound' });
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('sound'))).toBe('on');

  await page.reload();
  await page.waitForSelector('body[data-theme]', { state: 'attached' });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('sound'))).toBeNull();
});

test('the skip link stays out of sight until it has focus', async ({ page }) => {
  await openHydrated(page, '/about');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  expect((await skip.boundingBox())!.y + (await skip.boundingBox())!.height).toBeLessThanOrEqual(0);
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(0);
});

test('every page says which station it is docked at', async ({ page }) => {
  for (const route of routes) {
    await openHydrated(page, route);
    await expect(page.locator('.station-readout').first()).toContainText(/Docked at the /);
  }
});

test('every role on the experience page wears its mission patch', async ({ page }) => {
  await openHydrated(page, '/experience');
  const roles = page.locator('.xp__list > li');
  await expect(page.locator('.xp__patch')).toHaveCount(await roles.count());
  await expect(page.locator('.xp__patch').first()).toContainText('MISSION');
});
