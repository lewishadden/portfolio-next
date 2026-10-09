import { expect, openHydrated, test } from './fixtures';

test.describe('without WebGL', () => {
  test.use({ world: 'on' });

  test('falls back to the 2D station renders', async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        value: function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
          if (type.includes('webgl')) return null;
          return (getContext as (...args: unknown[]) => unknown).call(this, type, ...rest);
        },
      });
    });
    await page.goto('/about');
    await expect(page.locator('html')).toHaveAttribute('data-world', 'off');
    await expect(page.locator('.station-fallback')).toBeVisible();
    await expect(page.getByRole('button', { name: '3D effects' })).toBeDisabled();
    await page.waitForTimeout(2500);
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});

test.describe('before the app starts', () => {
  test.use({ world: 'on' });

  test('the page knows the world will run', async ({ page }) => {
    // No script chunk loads: only ThemeScript, inline in <head>, runs
    await page.route('**/_next/static/chunks/**/*.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-world-expected', '');
  });
});

test('the world is not expected once the visitor has switched it off', async ({ page }) => {
  await page.route('**/_next/static/chunks/**/*.js', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-world', 'off');
  await expect(page.locator('html')).not.toHaveAttribute('data-world-expected');
});

test('no loading screen holds the page when the world is off', async ({ page }) => {
  await openHydrated(page, '/');
  await expect(page.locator('html')).not.toHaveAttribute('data-boot');
  await expect(page.locator('.boot')).toHaveCount(0);
  await expect(page.locator('#main-content')).not.toHaveAttribute('inert');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('free roam is a few tab stops in, not after the whole page', async ({ page }) => {
  await openHydrated(page, '/');
  // Its label depends on whether the world is on: the button itself is what counts
  const roam = page.locator('.roam-fab');
  await expect(roam).toBeVisible();
  let stops = 0;
  while (stops < 15 && !(await roam.evaluate((el) => el === document.activeElement))) {
    await page.keyboard.press('Tab');
    stops++;
  }
  await expect(roam).toBeFocused();
});

test('with the world switched off, a still sky and 2D renders stand in for it', async ({
  page,
}) => {
  for (const path of ['/skills', '/projects/drive-king']) {
    await openHydrated(page, path);
    await expect(page.locator('html')).toHaveAttribute('data-world', 'off');
    await expect(page.locator('.station-fallback')).toBeVisible();
  }
  const stars = await page
    .locator('.world__backdrop')
    .evaluate((el) => getComputedStyle(el, '::after').backgroundImage);
  expect(stars).toContain('radial-gradient');

  // The corner button says what it does now: it turns the world back on
  const turnOn = page.getByRole('button', { name: 'Turn on 3D' });
  await turnOn.click();
  await expect(page.locator('html')).toHaveAttribute('data-world', 'on');
  await expect(page.getByRole('button', { name: 'Free roam' })).toBeVisible();
});

test.describe('3D effects toggle', () => {
  // Reduced motion renders on demand, so software WebGL isn't redrawing all the time
  test.use({ world: 'on', reducedMotion: 'reduce' });

  // @webgl: runs in the chromium-webgl project, the only one with WebGL
  test(
    'switches the world off, and the choice survives a reload',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/about');
      const toggle = page.getByRole('button', { name: '3D effects' });
      await expect(page.locator('html')).toHaveAttribute('data-world', 'on');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.world canvas')).toHaveCount(1, { timeout: 20_000 });

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('html')).toHaveAttribute('data-world', 'off');
      await expect(page.locator('.world canvas')).toHaveCount(0);
      await expect(page.locator('.station-fallback')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('world'))).toBe('off');

      // Applied before hydration by ThemeScript, so there is no flash of the world
      await page.reload({ waitUntil: 'commit' });
      await page.waitForSelector('html[data-world]', { state: 'attached' });
      await expect(page.locator('html')).toHaveAttribute('data-world', 'off');

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('html')).toHaveAttribute('data-world', 'on');
      expect(await page.evaluate(() => localStorage.getItem('world'))).toBeNull();
    }
  );
});

test.describe('tour and explore modes', () => {
  test.use({ world: 'on', reducedMotion: 'reduce' });

  test('take over the page and hand it back', { tag: '@webgl' }, async ({ page }) => {
    await openHydrated(page, '/');
    await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
    // The page stays inert under the loading screen until it lifts
    await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
    const main = page.locator('#main-content');

    // The guided tour hides the page while it flies station to station. The
    // pointer rests where its caption card appears, which holds the tour at
    // each stop: software WebGL makes every action slow, and the tour moves
    // on by itself in real time
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height - 120);
    await page.getByRole('button', { name: 'Take the tour' }).focus();
    await page.keyboard.press('Enter');
    const tour = page.getByRole('region', { name: 'Guided tour' });
    await expect(tour).toBeVisible();
    await expect(tour).toContainText('01 / 06');
    await expect(main).toHaveAttribute('inert', '');
    await expect(page.locator('html')).toHaveAttribute('data-world-mode', 'tour');

    await tour.getByRole('button', { name: 'Next stop' }).click();
    await expect(tour).toContainText('02 / 06');
    await tour.getByRole('button', { name: 'Visit About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(tour).toBeHidden();
    await expect(main).not.toHaveAttribute('inert');

    // Free flight from the command palette; Escape lands back on the page
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await palette.getByRole('combobox', { name: 'Command' }).fill('free flight');
    await page.keyboard.press('Enter');
    const hud = page.getByRole('region', { name: 'Explore mode' });
    await expect(hud).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-world-mode', 'explore');
    await expect(main).toHaveAttribute('inert', '');

    // Hidden signals: none found yet
    await expect(hud.getByText('0 of 5 hidden signals found')).toBeAttached();

    // Every station is marked; its number key sets the autopilot for it
    const stations = hud.getByRole('list', { name: 'Stations' });
    await expect(stations.getByRole('button')).toHaveCount(6);
    const projects = stations.getByRole('button', { name: /^Autopilot to Projects/ });
    await expect(projects).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Digit3');
    await expect(projects).toHaveAttribute('aria-pressed', 'true');
    await expect(
      hud.getByRole('status').filter({ hasText: 'Autopilot to Projects' })
    ).toBeVisible();
    await page.keyboard.press('Digit3');
    await expect(projects).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press('Escape');
    await expect(hud).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-world-mode', 'page');
    await expect(main).not.toHaveAttribute('inert');
    await expect(page).toHaveURL(/\/about$/);

    // The floating button toggles free roam too. Starting it locks the
    // pointer where the browser allows, and a locked pointer clicks the
    // page, not the button: the browser's own Esc frees it first
    await page.getByRole('button', { name: 'Free roam' }).click();
    await expect(hud).toBeVisible();
    await page.evaluate(() => document.exitPointerLock());
    await page.getByRole('button', { name: 'Exit free roam' }).click();
    await expect(hud).toBeHidden();
    await expect(main).not.toHaveAttribute('inert');

    // Loaded moments ago, everything is cached: a reload skips the loading screen
    await page.reload({ waitUntil: 'commit' });
    await page.waitForSelector('html[data-theme]', { state: 'attached' });
    await expect(page.locator('html')).not.toHaveAttribute('data-boot');
  });
});

test.describe('the guided tour', () => {
  test.use({ world: 'on', reducedMotion: 'reduce' });

  test(
    'starts where you are and steps with the keyboard to a closing card',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/skills');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });

      await page.keyboard.press('ControlOrMeta+k');
      const palette = page.getByRole('dialog', { name: 'Command palette' });
      await palette.getByRole('combobox', { name: 'Command' }).fill('guided tour');
      await page.keyboard.press('Enter');
      const tour = page.getByRole('region', { name: 'Guided tour' });
      const title = tour.getByRole('heading', { level: 2 });

      // The first stop is the station on show, and still reads 01
      await expect(tour).toContainText('01 / 06');
      await expect(title).toContainText('Skills');
      await expect(tour).toBeFocused();

      // Space on the card pauses it; the button says so
      const pause = tour.getByRole('button', { name: 'Pause the tour' });
      await page.keyboard.press('Space');
      await expect(pause).toHaveAttribute('aria-pressed', 'true');

      // → and ← step through the stops, round from where it started
      await page.keyboard.press('ArrowRight');
      await expect(tour).toContainText('02 / 06');
      await expect(title).toContainText('Contact');
      await page.keyboard.press('ArrowLeft');
      await expect(tour).toContainText('01 / 06');
      await expect(title).toContainText('Skills');
      await page.keyboard.press('ArrowLeft');
      await expect(tour).toContainText('01 / 06');

      // Past the last stop, a closing card waits for a choice
      for (const stop of ['02', '03', '04', '05', '06']) {
        await page.keyboard.press('ArrowRight');
        await expect(tour).toContainText(`${stop} / 06`);
      }
      await expect(title).toContainText('Projects');
      // Space again plays it (the pointer resting on the card holds the
      // countdown meanwhile)
      await tour.hover();
      await page.keyboard.press('Space');
      await expect(pause).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('ArrowRight');
      await expect(tour).toContainText('Complete');
      await expect(tour.getByRole('button', { name: 'Open Contact' })).toBeVisible();
      await expect(tour.getByRole('button', { name: 'Fly freely from here' })).toBeVisible();
      // The closing card has nothing to pause: Space there leaves the last stop playing
      await expect(tour).toBeFocused();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowLeft');
      await expect(tour).toContainText('06 / 06');
      await expect(pause).toHaveAttribute('aria-pressed', 'false');
      await expect(tour).not.toContainText('Paused');
      await page.keyboard.press('ArrowRight');
      await tour.getByRole('button', { name: /^Back to Skills/ }).click();
      await expect(tour).toBeHidden();
      await expect(page).toHaveURL(/\/skills$/);
      await expect(page.locator('#main-content')).not.toHaveAttribute('inert');
    }
  );
});

test.describe('leaving the tour for a page', () => {
  // Full motion: the camera flies, and the page you leave would fly off with it
  test.use({ world: 'on' });

  test(
    'the hidden page never shows as the camera leaves, and the new one waits for it',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
      const { width, height } = page.viewportSize()!;
      await page.mouse.move(width / 2, height - 120);
      await page.getByRole('button', { name: 'Take the tour' }).click();
      const tour = page.getByRole('region', { name: 'Guided tour' });
      await expect(tour).toContainText('01 / 06');
      await tour.getByRole('button', { name: 'Next stop' }).click();
      await expect(tour).toContainText('02 / 06');

      // Every copy of a page that leaves with the camera, and every mode the page goes through
      await page.evaluate(() => {
        const log = { ghosts: [] as string[], modes: [] as string[] };
        (window as unknown as { handover: typeof log }).handover = log;
        new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node instanceof HTMLElement && node.classList.contains('page-ghost')) {
                log.ghosts.push(node.textContent ?? '');
              }
            }
          }
        }).observe(document.body, { childList: true });
        new MutationObserver(() => {
          log.modes.push(document.documentElement.dataset.worldMode ?? '');
        }).observe(document.documentElement, { attributeFilter: ['data-world-mode'] });
      });
      await tour.getByRole('button', { name: 'Visit About' }).click();
      await expect(page).toHaveURL(/\/about$/);
      await expect(page.locator('html')).toHaveAttribute('data-world-mode', 'page', {
        timeout: 20_000,
      });
      await expect(page.locator('#main-content')).not.toHaveAttribute('inert');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const log = await page.evaluate(
        () => (window as unknown as { handover: { ghosts: string[]; modes: string[] } }).handover
      );
      expect(log.ghosts).toEqual([]);
      // Hidden until the camera was back: the tour, then the return, then the page
      expect(log.modes.filter((mode, i) => mode !== log.modes[i - 1])).toEqual([
        'returning',
        'page',
      ]);
      // However the copy arrived, it settles with no transform or filter left
      // on its wrapper (either would trap the page's fixed elements)
      await expect
        .poll(() =>
          page.evaluate(() => {
            const wrapper = document.querySelector('#main-content > div:not(.page-sweep)')!;
            const { transform, filter } = getComputedStyle(wrapper);
            return [transform, filter];
          })
        )
        .toEqual(['none', 'none']);
    }
  );
});

test.describe('coming back from the tour and free roam', () => {
  test.use({ world: 'on', reducedMotion: 'reduce' });

  test(
    'keyboard focus returns to the control that started them',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });

      // The tour's card takes focus; Esc hands it back to the button that started it
      const start = page.getByRole('button', { name: 'Take the tour' });
      await start.focus();
      await page.keyboard.press('Enter');
      const tour = page.getByRole('region', { name: 'Guided tour' });
      await expect(tour).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(tour).toBeHidden();
      await expect(start).toBeFocused();

      // Free roam from its button, then off into the HUD's station list
      const roam = page.getByRole('button', { name: 'Free roam' });
      await roam.focus();
      await page.keyboard.press('Enter');
      const hud = page.getByRole('region', { name: 'Explore mode' });
      await expect(hud).toBeVisible();
      await page.evaluate(() => document.exitPointerLock());
      await hud
        .getByRole('list', { name: 'Stations' })
        .getByRole('button', { name: /^Autopilot to Projects/ })
        .focus();
      await page.keyboard.press('Escape');
      await expect(hud).toBeHidden();
      await expect(roam).toBeFocused();
    }
  );
});

test.describe('free roam controls', () => {
  test.use({ world: 'on', reducedMotion: 'reduce' });

  test(
    'Enter on a station marker sets the autopilot, not a dock as well',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
      await page.getByRole('button', { name: 'Free roam' }).click();
      const hud = page.getByRole('region', { name: 'Explore mode' });
      await expect(hud).toBeVisible();
      await page.evaluate(() => document.exitPointerLock());

      // Free roam starts beside Home, close enough to dock: Enter anywhere
      // but on a control docks
      await expect(hud.getByRole('button', { name: /^Dock at Home/ })).toBeVisible({
        timeout: 30_000,
      });
      const projects = hud
        .getByRole('list', { name: 'Stations' })
        .getByRole('button', { name: /^Autopilot to Projects/ });
      await projects.focus();
      await page.keyboard.press('Enter');
      await expect(projects).toHaveAttribute('aria-pressed', 'true');
      await page.waitForTimeout(600);
      await expect(hud.getByText('Docking at')).toHaveCount(0);
      await expect(page).toHaveURL(/\/$/);
    }
  );

  test(
    'Enter docks where a station marker clicked with the mouse flew the ship',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
      await page.getByRole('button', { name: 'Free roam' }).click();
      const hud = page.getByRole('region', { name: 'Explore mode' });
      await expect(hud).toBeVisible();
      await page.evaluate(() => document.exitPointerLock());

      // A mouse click focuses the marker in Chrome; the autopilot flies to
      // About and parks there. The button itself has no size: its label is
      // what the mouse lands on
      const about = hud
        .getByRole('list', { name: 'Stations' })
        .getByRole('button', { name: /^Autopilot to About/ });
      await about.locator('.waypoint__text').click();
      await expect(about).toHaveAttribute('aria-pressed', 'true');
      await expect(hud.getByRole('button', { name: /^Dock at About/ })).toBeVisible({
        timeout: 90_000,
      });
      // Enter is the dock shortcut, not the marker's (which would only set course again)
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/about$/, { timeout: 30_000 });
    }
  );

  test(
    'a click on something in 3D in free roam leaves the page where it was',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/skills');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
      await page.getByRole('button', { name: 'Free roam' }).click();
      const hud = page.getByRole('region', { name: 'Explore mode' });
      await expect(hud).toBeVisible();
      const scrolled = await page.evaluate(() => window.scrollY);

      // What a click on a skill badge asks for (focusOnPage): on the page it
      // brings the skill's row into view, here (the last one) far below
      await page.evaluate(() => {
        const targets = document.querySelectorAll<HTMLElement>(
          '#main-content [data-world-target^="skill:"]'
        );
        const id = targets[targets.length - 1].dataset.worldTarget;
        window.dispatchEvent(new CustomEvent('world:focus', { detail: id }));
      });
      await page.waitForTimeout(800);
      expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
      await expect(page.locator('#main-content .world-ping')).toHaveCount(0);
    }
  );

  test(
    'the first free roam coaches, then keeps the keys behind a Controls button',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
      const roam = page.getByRole('button', { name: 'Free roam' });
      await roam.click();
      const hud = page.getByRole('region', { name: 'Explore mode' });
      await expect(hud).toBeVisible();
      await page.evaluate(() => document.exitPointerLock());

      // Three steps, the first one current; the keys are listed meanwhile
      const coach = hud.getByRole('region', { name: 'Flight training' });
      await expect(coach.getByRole('listitem')).toHaveCount(3);
      await expect(coach.getByRole('listitem').first()).toHaveAttribute('aria-current', 'step');
      await expect(hud.getByText('autopilot', { exact: false }).first()).toBeVisible();

      // Skipped, it is gone for good and the keys fold away behind Controls
      await coach.getByRole('button', { name: 'Skip' }).click();
      await expect(coach).toBeHidden();
      const controls = hud.getByRole('button', { name: 'Controls', exact: true });
      await expect(controls).toHaveAttribute('aria-expanded', 'false');
      const legend = page.locator(`#${await controls.getAttribute('aria-controls')}`);
      await expect(legend).toBeHidden();
      await controls.click();
      await expect(controls).toHaveAttribute('aria-expanded', 'true');
      await expect(legend).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(hud).toBeHidden();
      await roam.click();
      await expect(hud).toBeVisible();
      await expect(hud.getByRole('region', { name: 'Flight training' })).toHaveCount(0);
    }
  );
});

test.describe('free roam on touch', () => {
  test.use({
    world: 'on',
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 664 },
    isMobile: true,
    hasTouch: true,
  });

  test(
    'twin thumbsticks hold for the whole drag, one under each thumb',
    { tag: '@webgl' },
    async ({ page, context }) => {
      await openHydrated(page, '/');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
      await page.getByRole('button', { name: 'Free roam' }).tap();
      const hud = page.getByRole('region', { name: 'Explore mode' });
      await expect(hud).toBeVisible();

      // Real touches, through the browser's own gesture handling: a drag the
      // browser takes for a scroll is cancelled after a few pixels
      const cdp = await context.newCDPSession(page);
      const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: number[][]) =>
        cdp.send('Input.dispatchTouchEvent', {
          type,
          touchPoints: points.map(([x, y], id) => ({ x, y, id })),
        });
      const [move, look] = [
        hud.locator('.explore-hud__stick').first(),
        hud.locator('.explore-hud__stick').last(),
      ];
      const knob = (stick: typeof move, axis: string) =>
        stick.evaluate((el, name) => parseFloat(el.style.getPropertyValue(name)), axis);

      // Left thumb flies forward, in small steps like a real drag
      await touch('touchStart', [[90, 520]]);
      for (let i = 1; i <= 10; i++) await touch('touchMove', [[90, 520 - i * 4]]);
      // The right thumb takes the look stick while the left still flies
      await touch('touchStart', [
        [90, 480],
        [300, 520],
      ]);
      for (let i = 1; i <= 10; i++)
        await touch('touchMove', [
          [90, 480],
          [300 + i * 4, 520],
        ]);

      await expect(move).toHaveAttribute('data-active', '');
      await expect(look).toHaveAttribute('data-active', '');
      // Pointer moves arrive with the next frame, so wait for the last one
      await expect.poll(() => knob(move, '--ky')).toBeCloseTo(-40);
      await expect.poll(() => knob(look, '--kx')).toBeCloseTo(40);

      // Pushed on out to its dashed ring, the move stick boosts and the rocket jet fires
      const jet = hud.locator('.explore-hud__jet');
      await expect(move).not.toHaveAttribute('data-boost');
      await expect(jet).not.toHaveAttribute('data-on');
      await touch('touchMove', [
        [90, 414],
        [340, 520],
      ]);
      await expect(move).toHaveAttribute('data-boost', '');
      await expect(jet).toHaveAttribute('data-on', '');

      // Lifting one thumb leaves the other holding its stick
      await touch('touchEnd', [[340, 520]]);
      await expect(move).not.toHaveAttribute('data-active');
      await expect(jet).not.toHaveAttribute('data-on');
      await expect(look).toHaveAttribute('data-active', '');
      await touch('touchEnd', []);
      await expect(look).not.toHaveAttribute('data-active');
    }
  );
});

test.describe('warming the next station on a phone', () => {
  test.use({
    world: 'on',
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test(
    'a station mounts before the tap that flies to it lands',
    { tag: '@webgl' },
    async ({ page, context }) => {
      // A station's hull is fetched once to prefetch it, and again by the
      // loader when the station mounts (from the HTTP cache)
      const requests: string[] = [];
      page.on('request', (request) => requests.push(new URL(request.url()).pathname));
      const loads = (station: string) =>
        requests.filter((path) => path === `/static/models/stations/sd/${station}.glb`).length;

      await openHydrated(page, '/about');
      await page.waitForSelector('.world--ready', { state: 'attached', timeout: 120_000 });
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 60_000 });
      expect(loads('experience')).toBe(0);

      // Phones never hover. Reading on to the page's way on (its page nav)
      // warms the station its first link leads to
      await page.locator('#main-content .page-nav').scrollIntoViewIfNeeded();
      await expect.poll(() => loads('experience'), { timeout: 30_000 }).toBeGreaterThanOrEqual(2);

      // A finger landing on a link warms its station before it lifts. Held
      // while the loads are counted (and then let go of without a click,
      // as a long press is), so nothing else can have mounted it
      const link = page.locator('#main-content a[href="/contact"]').first();
      await link.scrollIntoViewIfNeeded();
      const box = (await link.boundingBox())!;
      const cdp = await context.newCDPSession(page);
      const touch = (type: 'touchStart' | 'touchCancel', points: number[][]) =>
        cdp.send('Input.dispatchTouchEvent', {
          type,
          touchPoints: points.map(([x, y], id) => ({ x, y, id })),
        });
      expect(loads('contact')).toBe(0);
      await touch('touchStart', [[box.x + box.width / 2, box.y + box.height / 2]]);
      await expect.poll(() => loads('contact'), { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
      await expect(page).toHaveURL(/\/about$/);
      await touch('touchCancel', []);

      await link.tap();
      await expect(page).toHaveURL(/\/contact$/);
    }
  );
});
