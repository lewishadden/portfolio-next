import { test as plain } from '@playwright/test';

import { expect, openHydrated, test } from './fixtures';

import type { Page } from '@playwright/test';

const levels = ['full', 'calm', 'still'] as const;

/** The hero name's letters rise in on a CSS animation (SplitText): its name, or 'none' */
const entrance = (page: Page) =>
  page
    .locator('#main-content .split__char')
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);

const saveMotion = (page: Page, level: string) =>
  page.addInitScript((saved) => {
    try {
      localStorage.setItem('motion', saved);
    } catch {
      // storage blocked: the OS setting decides
    }
  }, level);

test.describe('motion levels', () => {
  for (const level of levels) {
    test(`a saved "${level}" level applies, and only full plays entrances`, async ({ page }) => {
      await saveMotion(page, level);
      await openHydrated(page, '/');
      await expect(page.locator('html')).toHaveAttribute('data-motion', level);
      expect(await entrance(page)).toBe(level === 'full' ? 'split-rise' : 'none');
    });
  }

  test('is set before the app starts', async ({ page }) => {
    await saveMotion(page, 'calm');
    // No script chunk loads: only ThemeScript, inline in <head>, runs
    await page.route('**/_next/static/chunks/**/*.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'calm');
    expect(await entrance(page)).toBe('none');
  });

  test.describe('with the OS asking for reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('follows it by default', async ({ page }) => {
      await openHydrated(page, '/');
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
      expect(await entrance(page)).toBe('none');

      // Switched off in the OS while the page is open
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    });

    test('a saved "full" overrides it', async ({ page }) => {
      await saveMotion(page, 'full');
      await openHydrated(page, '/');
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
      expect(await entrance(page)).toBe('split-rise');
    });
  });

  test('without a saved level, full motion follows the OS too', async ({ page }) => {
    await openHydrated(page, '/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  });

  test('a level saved in another tab applies here too', async ({ page, context }) => {
    await openHydrated(page, '/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    const other = await context.newPage();
    await openHydrated(other, '/about');
    await other.evaluate(() => localStorage.setItem('motion', 'calm'));
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'calm');
    await other.evaluate(() => localStorage.removeItem('motion'));
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  });
});

test.describe('motion levels in the world', () => {
  // Nothing saved and the OS asking for reduced motion: still, so software
  // WebGL draws on demand while the world loads, and there is no warp in
  test.use({ world: 'on', reducedMotion: 'reduce' });

  const openWorld = async (page: Page) => {
    await openHydrated(page, '/');
    await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
    await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  };

  test('a flight the level cuts short still arrives', { tag: '@webgl' }, async ({ page }) => {
    await openWorld(page);
    // Stats for nerds says when the camera is in flight
    await page.keyboard.press('Alt+Shift+KeyS');
    const stats = page.getByRole('complementary', { name: 'Rendering statistics' });
    await expect(stats).toContainText(/camera\s/);

    // Full motion: a link flies the camera to its station
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'About' })
      .click();
    await expect(stats).toContainText(/flight \d+%/);

    // Motion held back mid-flight: the camera cuts to the station, and the
    // flight is over (it used to stay in the air, the sector map with it)
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
    await expect(stats).not.toContainText(/flight \d+%/);
    await expect(page.locator('.nav-radar')).not.toHaveClass(/nav-radar--on/);
  });

  test('free roam keeps flying at still', { tag: '@webgl' }, async ({ page }) => {
    await openWorld(page);
    await page.getByRole('button', { name: 'Free roam' }).click();
    const hud = page.getByRole('region', { name: 'Explore mode' });
    await expect(hud).toBeVisible();

    // The autopilot flies on by itself, all the way in: only the canvas's own
    // frames move it. Drawn on demand, it stalled within a few seconds, once
    // free roam's stations had mounted and nothing else asked for a frame
    const projects = hud
      .getByRole('list', { name: 'Stations' })
      .getByRole('button', { name: /^Autopilot to Projects/ });
    const range = projects.locator('[data-km]');
    await expect(range).toHaveText(/^\d+ km$/);
    const km = async () => parseInt((await range.textContent()) ?? '', 10);
    const start = await km();
    await page.keyboard.press('Digit3');
    await expect(projects).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(km, { timeout: 90_000 }).toBeLessThan(start / 2);
  });
});

// Without JavaScript there is no level: the OS setting decides in CSS
plain.describe('motion without JavaScript', () => {
  plain.use({ javaScriptEnabled: false });

  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    plain(`the OS's "${reducedMotion}" decides`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await page.goto('/');
      await expect(page.locator('html')).not.toHaveAttribute('data-motion');
      expect(await entrance(page)).toBe(reducedMotion === 'reduce' ? 'none' : 'split-rise');
    });
  }
});
