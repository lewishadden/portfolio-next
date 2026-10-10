import { expect, test } from '@playwright/test';

import { routes, test as seeded } from './fixtures';

import type { Locator, Page } from '@playwright/test';

/**
 * Entrance animations render their starting state (opacity 0) into the
 * server HTML. Nothing may stay hidden because the app isn't running: not
 * without JavaScript, and not when the app never starts (ThemeScript's
 * failsafes). Nor may those failsafes mistake an app that is only slow to
 * start for one that never will.
 */

const pages = [...routes, '/projects/drive-king'];

/** The copy under each page's heading (the hero's tagline on the home page) */
const copy: Record<string, string[]> = {
  '/': ['.hero__tag'],
  '/experience': ['.page-sub', '.xp__role'],
  '/projects/drive-king': ['.project-body__desc'],
};

/** The lowest opacity any of the element's text shows at, counting every ancestor's */
const textOpacity = (locator: Locator) =>
  locator.evaluate((root) => {
    const shownAt = (el: Element) => {
      let opacity = 1;
      for (let at: Element | null = el; at; at = at.parentElement) {
        opacity *= Number(getComputedStyle(at).opacity);
      }
      return opacity;
    };
    const holders = [root, ...root.querySelectorAll('*')].filter((el) =>
      [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
      )
    );
    return Math.min(...holders.map(shownAt));
  });

/** The page's heading, the copy under it and the footer's call to action are all there to read */
async function expectReadable(page: Page, path: string, timeout = 10_000) {
  const main = page.locator('#main-content');
  const targets = [
    main.locator('h1'),
    ...(copy[path] ?? ['.page-sub']).map((selector) => main.locator(selector).first()),
    page.locator('.footer__cta'),
  ];
  for (const target of targets) {
    await expect(target).toBeVisible();
    // Letters still rising in (CSS animations run without the app) settle within it
    await expect.poll(() => textOpacity(target), { timeout }).toBe(1);
  }
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const path of pages) {
    test(`${path} shows its copy`, async ({ page }) => {
      await page.goto(path);
      await expectReadable(page, path);
      // ThemeScript raises the loading screen; without it, it never shows
      await expect(page.locator('.boot')).toBeHidden();
    });
  }
});

/** Every script chunk fails to load (a deploy's old chunks gone, a blocker): the app never starts */
async function breakTheApp(page: Page) {
  await page.route('**/_next/static/chunks/**', (route) =>
    route.request().resourceType() === 'script' ? route.abort() : route.continue()
  );
}

seeded.describe('when the app never starts', () => {
  seeded('the page shows after a few seconds', async ({ page }) => {
    await breakTheApp(page);
    await page.goto('/about');
    const root = page.locator('html');
    await expect(root).not.toHaveAttribute('data-boot');
    await expect(root).toHaveAttribute('data-failsafe', '', { timeout: 8_000 });
    await expectReadable(page, '/about');
    await expect(root).not.toHaveAttribute('data-hydrated');
  });

  seeded.describe('behind the loading screen', () => {
    seeded.use({ world: 'on' });

    seeded('its skip button still lifts it', async ({ page }) => {
      await breakTheApp(page);
      await page.goto('/');
      const root = page.locator('html');
      await expect(root).toHaveAttribute('data-boot', 'loading');
      // In the server HTML, appearing after a few seconds
      const skip = page.getByRole('button', { name: 'Skip to the page' });
      await expect(skip).toBeVisible({ timeout: 10_000 });
      await skip.click();
      await expect(root).not.toHaveAttribute('data-boot');
      await expect(page.locator('.boot')).toBeHidden();
      await expectReadable(page, '/');
      // Nor will the world run: the 2D renders stand in, and its windows close
      await expect(root).toHaveAttribute('data-world', 'off');

      // The page scrolls again
      const { width, height } = page.viewportSize()!;
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, 600);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    });

    seeded('it gives up on its own', async ({ page }) => {
      seeded.slow();
      await breakTheApp(page);
      await page.goto('/about');
      const root = page.locator('html');
      await expect(root).toHaveAttribute('data-boot', 'loading');
      await expect(root).not.toHaveAttribute('data-boot', { timeout: 35_000 });
      await expect(page.locator('.boot')).toBeHidden();
      await expectReadable(page, '/about');
    });
  });
});

/** Every script chunk arrives late (a slow phone or connection): the app starts, after the failsafes */
async function slowTheApp(page: Page, delay: number) {
  await page.route('**/_next/static/chunks/**', async (route) => {
    if (route.request().resourceType() === 'script') {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await route.continue();
  });
}

interface WorldSeen {
  frames: number;
  /** html[data-world='off'] */
  off: boolean;
  /** A world window closed */
  closed: boolean;
  /** A 2D station render shown */
  rendered: boolean;
}

/** Checks every painted frame, from the first, for any sign of the world being taken for off */
async function watchTheWorld(page: Page) {
  await page.addInitScript(() => {
    const seen = { frames: 0, off: false, closed: false, rendered: false };
    (window as unknown as { worldSeen: typeof seen }).worldSeen = seen;
    const shown = (selector: string) => {
      const el = document.querySelector(`#main-content ${selector}`);
      return el ? getComputedStyle(el).display !== 'none' : undefined;
    };
    const frame = () => {
      seen.frames += 1;
      if (document.documentElement.getAttribute('data-world') === 'off') seen.off = true;
      if (shown('.world-window') === false) seen.closed = true;
      if (shown('.station-fallback')) seen.rendered = true;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

const worldSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { worldSeen: WorldSeen }).worldSeen);

seeded.describe('when the app starts late', () => {
  // Narrow, so the pages open world windows
  seeded.use({ world: 'on', viewport: { width: 390, height: 844 } });
  seeded.afterEach(({ page }) => page.unrouteAll({ behavior: 'ignoreErrors' }));

  seeded('the failsafe shows the copy but keeps the world windows open', async ({ page }) => {
    await slowTheApp(page, 6_000);
    await watchTheWorld(page);
    // A returning visitor: no loading screen
    await page.addInitScript(() => localStorage.setItem('world-loaded-at', String(Date.now())));
    await page.goto('/contact', { waitUntil: 'domcontentloaded' });
    const root = page.locator('html');
    await expect(root).not.toHaveAttribute('data-boot');
    await expect(root).toHaveAttribute('data-failsafe', '', { timeout: 8_000 });
    await expect(root).not.toHaveAttribute('data-hydrated');
    // The app is only late: the world's window stays open, with no 2D render in it
    await expect(page.locator('#main-content .world-window')).toHaveCSS('display', 'block');
    await expect(root).not.toHaveAttribute('data-world', 'off');

    await expect(root).toHaveAttribute('data-hydrated', '', { timeout: 15_000 });
    await expect(root).toHaveAttribute('data-world', 'on');
    const seen = await worldSeen(page);
    expect(seen.frames).toBeGreaterThan(0);
    expect(seen).toMatchObject({ off: false, closed: false, rendered: false });
  });

  seeded('skipping the loading screen keeps the world windows open', async ({ page }) => {
    await slowTheApp(page, 8_000);
    await watchTheWorld(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-boot', 'loading');
    const skip = page.getByRole('button', { name: 'Skip to the page' });
    await expect(skip).toBeVisible({ timeout: 10_000 });
    await skip.click();
    await expect(root).not.toHaveAttribute('data-boot');
    await expect(root).not.toHaveAttribute('data-hydrated');
    await expectReadable(page, '/');
    await expect(page.locator('#main-content .world-window')).toHaveCSS('display', 'block');
    await expect(root).not.toHaveAttribute('data-world', 'off');

    await expect(root).toHaveAttribute('data-hydrated', '', { timeout: 15_000 });
    await expect(root).toHaveAttribute('data-world', 'on');
    const seen = await worldSeen(page);
    expect(seen.frames).toBeGreaterThan(0);
    expect(seen).toMatchObject({ off: false, closed: false, rendered: false });
  });
});
