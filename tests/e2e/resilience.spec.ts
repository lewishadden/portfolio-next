import { expect, openHydrated, test } from './fixtures';

import type { Locator, Page } from '@playwright/test';

/** Opacity as seen on screen: the element's own times every ancestor's */
const effectiveOpacity = (locator: Locator) =>
  locator.evaluate((el) => {
    let opacity = 1;
    for (let node: Element | null = el; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  });

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

test('a page reached from the header shows its copy', async ({ page }) => {
  await openHydrated(page, '/');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'About' })
    .click();
  await expect(page).toHaveURL(/\/about$/);
  const heading = page.locator('#main-content h1');
  await expect(heading).toBeAttached();
  await expect.poll(() => effectiveOpacity(heading), { timeout: 3_000 }).toBeGreaterThan(0.95);
});

/** One animation frame: when it ran, the page's h1 and how visible it was */
type Sample = [time: number, heading: string, opacity: number];

test.describe('with the world on', () => {
  test.use({ world: 'on' });

  // @webgl: runs in the chromium-webgl project, the only one with WebGL
  test(
    'a page you come straight back to waits for the camera again',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/about');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
      const heading = page.locator('#main-content h1');
      await expect(heading).toContainText('About');
      await expect.poll(() => effectiveOpacity(heading), { timeout: 15_000 }).toBeGreaterThan(0.95);
      const about = (await heading.textContent())!;

      // Software WebGL draws a few frames a second and every Playwright call
      // waits on them, so the page records the heading itself, every frame
      await page.evaluate(() => {
        const log: Sample[] = [];
        (window as unknown as { revealLog: Sample[] }).revealLog = log;
        const sample = (time: number) => {
          const el = document.querySelector('#main-content h1');
          let opacity = 1;
          for (let node = el; node; node = node.parentElement) {
            opacity *= Number(getComputedStyle(node).opacity);
          }
          log.push([time, el?.textContent ?? '', el ? opacity : 0]);
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });

      // Off to Skills, and straight back before that flight is on approach:
      // the About copy shown a moment ago waits for the camera all over again
      await page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Skills' })
        .click();
      await expect(page).toHaveURL(/\/skills$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/about$/);
      // It does arrive: on approach, or after the longest hold
      await expect.poll(() => effectiveOpacity(heading), { timeout: 20_000 }).toBeGreaterThan(0.95);

      const log = await page.evaluate(
        () => (window as unknown as { revealLog: Sample[] }).revealLog
      );
      const away = log.findIndex(([, text]) => text !== about);
      const back = log.findIndex(([, text], i) => i > away && text === about);
      expect(away, 'Skills rendered').toBeGreaterThan(-1);
      expect(back, 'About rendered again').toBeGreaterThan(away);
      // Skills hadn't shown yet, so the last route shown was still About's
      const skills = log.slice(away, back).map(([, , opacity]) => opacity);
      expect(Math.max(...skills), 'Skills copy before turning back').toBeLessThan(0.05);

      // The camera can't be on approach before 0.66s of flight (the shortest
      // flight is 1.1s, on approach at 60%), and CameraRig counts at most
      // 1/20s of flight a frame: so not within 14 frames, nor 0.66s, and the
      // reveal waits 0.18s more. Shown straight away, the copy rises within
      // 0.6s on a fast machine and within 3 frames on a slow one. The bounds
      // leave room for frame order, and a slow machine may see the hold
      // (6.5s) run out first
      const shown = log.findIndex(([, , opacity], i) => i >= back && opacity > 0.05);
      expect(shown, 'About copy shown again').toBeGreaterThan(back);
      const frames = shown - back;
      const wait = log[shown][0] - log[back][0];
      const detail = `shown ${Math.round(wait)}ms and ${frames} frames after the route change`;
      expect(wait, detail).toBeGreaterThanOrEqual(700);
      expect(frames >= 12 || wait >= 6_500, detail).toBe(true);
    }
  );
});
