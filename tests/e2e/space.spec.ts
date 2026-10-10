import { expect, openHydrated, routes, test } from './fixtures';

import { rangeBetween, stationForPath, stationNames } from '../../components/World/routes';

import type { Page } from '@playwright/test';

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

test.describe('haptics on a touch device that can vibrate', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('are on by default, the palette turns them off and on, and the launch buzzes', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const buzzes: unknown[] = [];
      (window as unknown as { buzzes: unknown[] }).buzzes = buzzes;
      navigator.vibrate = (pattern) => {
        buzzes.push(pattern);
        return true;
      };
    });
    const buzzes = () => page.evaluate(() => (window as unknown as { buzzes: unknown[] }).buzzes);
    // The form's send is answered here: nothing is sent
    await page.route('**/api/sendmail', (route) => route.fulfill({ status: 200, body: '{}' }));
    await openHydrated(page, '/contact');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('ControlOrMeta+k');
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await dialog.getByRole('combobox', { name: 'Command' }).fill('haptics');
    await dialog.getByRole('option', { name: 'Turn haptics off' }).click();
    expect(await page.evaluate(() => localStorage.getItem('haptics'))).toBe('off');
    // Turning them back on gives a nudge (the tap allows it)
    await dialog.getByRole('option', { name: 'Turn haptics on' }).click();
    expect(await page.evaluate(() => localStorage.getItem('haptics'))).toBeNull();
    expect(await buzzes()).toEqual([[12]]);
    await dialog.getByRole('combobox', { name: 'Command' }).press('Escape');
    await expect(dialog).toBeHidden();

    await page.fill('#formFirstName', 'Test');
    await page.fill('#formLastName', 'Visitor');
    await page.fill('#formEmail', 'test@example.com');
    await page.fill('#formMessage', 'Checking the launch buzz');
    await page.locator('.contact-form__submit').click();
    await expect.poll(buzzes).toEqual([[12], [70, 30, 70, 30, 140]]);
  });
});

test('the skip link stays out of sight until it has focus', async ({ page }) => {
  await openHydrated(page, '/about');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  expect((await skip.boundingBox())!.y + (await skip.boundingBox())!.height).toBeLessThanOrEqual(0);
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(0);
});

test('the skip link takes focus to the page content', async ({ page }) => {
  await openHydrated(page, '/about');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  const main = page.locator('#main-content');
  await expect(main).toBeFocused();
  // Focusable from code only, with no ring round the whole page
  await expect(main).toHaveAttribute('tabindex', '-1');
  expect(await main.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
  // The next Tab goes on into the page, not back to the header
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('#main-content'))).toBe(true);
});

/** What each page's readout says once docked: the craft, and its range from Home */
const readout = (route: string) => {
  const station = stationForPath(route);
  const craft = stationNames[station].craft.toLowerCase();
  return station === 'home'
    ? `Docked at the ${craft}/Home port`
    : `Docked at the ${craft}/${rangeBetween(station, 'home')} km from Home`;
};
const readoutText = (page: Page) =>
  page
    .locator('#main-content .station-readout')
    .first()
    .evaluate((el) =>
      (el as HTMLElement).innerText
        .replace(/\s*\/\s*/, '/')
        .replace(/\s+/g, ' ')
        .trim()
    );

test('every page says which station it is docked at, and how far from Home', async ({ page }) => {
  for (const route of routes) {
    await openHydrated(page, route);
    await expect.poll(() => readoutText(page)).toBe(readout(route));
  }
});

test('the readout says the same without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(route);
    expect(await readoutText(page)).toBe(readout(route));
  }
  await context.close();
});

test('every role on the experience page wears its mission patch', async ({ page }) => {
  await openHydrated(page, '/experience');
  const roles = page.locator('.xp__list > li');
  await expect(page.locator('.xp__patch')).toHaveCount(await roles.count());
  await expect(page.locator('.xp__patch').first()).toContainText('MISSION');
});

test.describe('the footer manifest', () => {
  const check = async (page: Page) => {
    const nav = page.getByRole('navigation', { name: 'Footer navigation' });
    const links = nav.getByRole('link');
    await expect(links).toHaveCount(6);
    // Numbered from 00 as the page eyebrows are, About 01
    await expect(links.nth(0)).toContainText('00');
    await expect(links.nth(0)).toContainText('Gateway hub');
    await expect(links.nth(0)).toContainText(/\d+ km/);
    await expect(links.nth(1)).toContainText('01');
    await expect(links.nth(1)).toHaveAttribute('aria-current', 'page');
    await expect(links.nth(1)).toContainText('Docked');
    await expect(links.nth(1)).toHaveAccessibleName('About');
  };

  test('names each station, its range and where you are docked', async ({ page }) => {
    await openHydrated(page, '/about');
    await check(page);
  });

  test('is in the server HTML', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/about');
    await check(page);
    await context.close();
  });
});

test.describe('hailing the station', () => {
  test('needs the world: with 3D effects off there is nothing to hail', async ({ page }) => {
    await openHydrated(page, '/about');
    await expect(page.getByRole('button', { name: 'Hail the crew habitat' })).toBeHidden();
  });

  test.describe('with the world on', () => {
    test.use({ world: 'on', reducedMotion: 'reduce' });

    test('it answers, and says how', { tag: '@webgl' }, async ({ page }) => {
      await openHydrated(page, '/about');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
      const button = page.getByRole('button', { name: 'Hail the crew habitat' });
      await expect(button).toBeVisible();
      await button.click();
      // Held still, a hail is answered with a ping
      await expect(page.locator('#main-content').getByRole('status')).toHaveText(
        'The crew habitat answers with a ping'
      );

      // The command palette hails too
      await page.keyboard.press('ControlOrMeta+k');
      const dialog = page.getByRole('dialog', { name: 'Command palette' });
      await dialog.getByRole('combobox', { name: 'Command' }).fill('hail');
      await page.keyboard.press('Enter');
      await expect(dialog).toBeHidden();
      await expect(page.locator('#main-content').getByRole('status')).toHaveText(
        'The crew habitat answers with a ping'
      );
    });
  });
});

test.describe('the scene for screen readers', () => {
  test('is left out with 3D effects off', async ({ page }) => {
    await openHydrated(page, '/');
    await expect(page.locator('#main-content .station-readout__scene')).toBeHidden();
    await expect(page.locator('#main-content .station-readout').first()).not.toContainText(
      'In view:',
      { useInnerText: true }
    );
  });

  test.describe('with the world on', () => {
    test.use({ world: 'on', reducedMotion: 'reduce' });

    test('each station describes what the canvas shows', { tag: '@webgl' }, async ({ page }) => {
      await openHydrated(page, '/');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await expect(page.locator('#main-content .station-readout').first()).toContainText(
        'In view: An astronaut with a laptop floats before a swirling portal.'
      );
      await expect(page.locator('#main-content .station-readout__scene')).toBeAttached();
      await expect(page.locator('html')).toHaveAttribute('data-world', 'on');
    });
  });
});
