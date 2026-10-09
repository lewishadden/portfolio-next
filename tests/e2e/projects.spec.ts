import { expect, openHydrated, test } from './fixtures';

import type { Page } from '@playwright/test';

/** Brings a project to the front (the index link), where its "View details" lives */
async function pick(page: Page, name: string) {
  const index = page.getByRole('navigation', { name: 'Projects' });
  await index.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
}

test.describe('project modal', () => {
  test('opens at the project URL and closes back to the list', async ({ page }) => {
    await openHydrated(page, '/projects');
    await pick(page, 'Drive King');
    const card = page.getByRole('link', { name: 'View details for Drive King' });
    await expect(card).toHaveAttribute('href', '/projects/drive-king');

    await card.click();
    await expect(page).toHaveURL(/\/projects\/drive-king$/);
    const dialog = page.getByRole('dialog', { name: 'Drive King' });
    await expect(dialog).toBeVisible();
    // The project steps stay mounted underneath: no navigation happened
    await expect(page.getByRole('heading', { level: 1, name: 'Selected projects' })).toBeAttached();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(card).toBeFocused();
  });

  test('names the open project in the tab, as its page does', async ({ page }) => {
    await openHydrated(page, '/projects');
    const listTitle = await page.title();
    await pick(page, 'Drive King');
    await page.getByRole('link', { name: 'View details for Drive King' }).click();
    await expect(page.getByRole('dialog', { name: 'Drive King' })).toBeVisible();
    await expect(page).toHaveTitle('Drive King | Projects | Lewis Hadden');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page).toHaveTitle(listTitle);
  });

  test('the Back button closes it and Forward reopens it', async ({ page }) => {
    await openHydrated(page, '/projects');
    await pick(page, 'Sidenote');
    await page.getByRole('link', { name: 'View details for Sidenote' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sidenote' });
    await expect(dialog).toBeVisible();

    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects$/);

    await page.goForward();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/projects\/sidenote$/);
  });

  test('keeps the scroll position', async ({ page }) => {
    await openHydrated(page, '/projects');
    await pick(page, 'Audex');
    const card = page.getByRole('link', { name: 'View details for Audex' });
    const scrollY = () => page.evaluate(() => Math.round(window.scrollY));

    // Where the visitor left the list: scroll the card into view and let the
    // smooth scrolling (CSS + Lenis) settle before clicking
    await card.scrollIntoViewIfNeeded();
    let settled = -1;
    await expect
      .poll(async () => {
        const start = await scrollY();
        await page.waitForTimeout(250);
        settled = await scrollY();
        return settled === start;
      })
      .toBe(true);
    expect(settled).toBeGreaterThan(0);

    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close project details' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    // The dialog pins the page while open, snapping back anything that scrolls it
    await expect.poll(scrollY).toBe(settled);
  });
});

test.describe('project index', () => {
  test('picks the project in front, and every project keeps its own link', async ({ page }) => {
    await openHydrated(page, '/projects');
    const index = page.getByRole('navigation', { name: 'Projects' });
    const links = index.getByRole('link');
    await expect(links.first()).toHaveAttribute('aria-current', 'true');
    await expect(links.first()).toHaveAttribute('href', /^\/projects\/[\w-]+$/);

    const sidenote = index.getByRole('link', { name: 'Sidenote', exact: true });
    await sidenote.click();
    await expect(sidenote).toHaveAttribute('aria-current', 'true');
    await expect(links.first()).not.toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('heading', { level: 2, name: 'Sidenote' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View details for Sidenote' })).toBeVisible();

    // One crawlable link per project
    const count = await links.count();
    expect(count).toBeGreaterThan(5);
    const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(new Set(hrefs).size).toBe(count);
  });
});

test.describe('the ride without the world', () => {
  const pageY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
  /** Waits for the scroll (and any snap glide) to come to rest */
  const settledOn = (page: Page) =>
    expect
      .poll(async () => {
        const start = await pageY(page);
        await page.waitForTimeout(400);
        return (await pageY(page)) === start;
      })
      .toBe(true);

  test('a short scroll carries on to the next project, and the first docks', async ({ page }) => {
    await openHydrated(page, '/projects');
    const index = page.getByRole('navigation', { name: 'Projects' });
    const scrollY = () => pageY(page);
    const settled = () => settledOn(page);
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);

    // From the top, a short swipe docks on the first project rather than
    // going back up (the stage is further away than that)
    await page.mouse.wheel(0, 150);
    await settled();
    const docked = await page.evaluate(() => {
      const tour = document.querySelector<HTMLElement>('.projects__tour')!;
      const stage = document.querySelector<HTMLElement>('.projects__stage')!;
      return (
        tour.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(stage).top)
      );
    });
    expect(Math.abs((await scrollY()) - docked)).toBeLessThan(4);
    await expect(index.getByRole('link', { name: 'ZGS Carpentry', exact: true })).toHaveAttribute(
      'aria-current',
      'true'
    );

    // 150px is well short of halfway to the next project: it still goes on to it
    await page.mouse.wheel(0, 150);
    await settled();
    await expect(index.getByRole('link', { name: 'Sidenote', exact: true })).toHaveAttribute(
      'aria-current',
      'true'
    );
    await expect(page.getByRole('heading', { level: 2, name: 'Sidenote' })).toBeVisible();

    // And back the same way
    await page.mouse.wheel(0, -150);
    await settled();
    await expect(index.getByRole('link', { name: 'ZGS Carpentry', exact: true })).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  // A swipe onwards sets off a glide to the next project. Just as it starts,
  // a second swipe the same way catches it: it goes on, however short it is
  // (measured from the stop the glide was heading for, a 70px swipe read as
  // one back; measured from where it caught the glide, a 30px one was too
  // short to count and went back to the nearest project, the first)
  for (const swipe of [70, 30]) {
    test(`a ${swipe}px swipe onwards that catches a snap glide keeps going its way`, async ({
      page,
    }) => {
      await openHydrated(page, '/projects');
      const index = page.getByRole('navigation', { name: 'Projects' });
      const { width, height } = page.viewportSize()!;
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, 150);
      await settledOn(page);
      await expect(index.getByRole('link', { name: 'ZGS Carpentry', exact: true })).toHaveAttribute(
        'aria-current',
        'true'
      );

      const swiped = (await pageY(page)) + 100;
      await page.mouse.wheel(0, 100);
      await page.evaluate(
        ([rest, deltaY]) =>
          new Promise<void>((resolve) => {
            // The wheel's own scroll comes to rest, then the glide sets off
            let arrived = false;
            const watch = () => {
              arrived ||= window.scrollY >= rest - 2;
              if (!arrived || window.scrollY <= rest + 3) {
                requestAnimationFrame(watch);
                return;
              }
              document.body.dispatchEvent(
                new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
              );
              resolve();
            };
            watch();
          }),
        [swiped, swipe]
      );
      await settledOn(page);
      await expect(index.getByRole('link', { name: 'Sidenote', exact: true })).toHaveAttribute(
        'aria-current',
        'true'
      );
    });
  }

  test('a swipe back that catches a ride to a project stops a project short', async ({ page }) => {
    await openHydrated(page, '/projects');
    const index = page.getByRole('navigation', { name: 'Projects' });
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, 150);
    await settledOn(page);
    await expect(index.getByRole('link', { name: 'ZGS Carpentry', exact: true })).toHaveAttribute(
      'aria-current',
      'true'
    );

    // The index rides down to the seventh project. As the ride arrives, a
    // 100px swipe back catches it: measured from there it goes back one
    // project (measured from the first project, where the scroll last
    // rested, it read as a swipe onwards and went on to the seventh)
    const ride = page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const tour = document.querySelector<HTMLElement>('.projects__tour')!;
          const stage = document.querySelector<HTMLElement>('.projects__stage')!;
          const steps = document.querySelectorAll('.projects__index-link').length - 1;
          const docked =
            tour.getBoundingClientRect().top +
            window.scrollY -
            parseFloat(getComputedStyle(stage).top);
          const stop = docked + ((tour.offsetHeight - stage.offsetHeight) / steps) * 6;
          let last = window.scrollY;
          const watch = () => {
            const y = window.scrollY;
            const moving = y !== last;
            last = y;
            if (!moving || stop - y > 50 || stop - y < 3) {
              requestAnimationFrame(watch);
              return;
            }
            document.body.dispatchEvent(
              new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
            );
            resolve();
          };
          watch();
        })
    );
    await index.getByRole('link', { name: 'Sanctions Checker', exact: true }).click();
    await ride;
    await settledOn(page);
    await expect(index.getByRole('link', { name: 'ADP RUN', exact: true })).toHaveAttribute(
      'aria-current',
      'true'
    );
  });
});

test.describe('the helix ride', () => {
  test.use({ world: 'on' });

  test(
    'holds the first project back until its stage docks, and snaps to projects',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/projects');
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 120_000 });
      // The header's live logo starts its own WebGL canvas once the world is
      // ready. Software WebGL stalls the page for seconds while it does, so
      // let it start (or give up on it) before timing any scroll
      await page
        .locator('.brand-mark-live--3d')
        .waitFor({ state: 'attached', timeout: 60_000 })
        .catch(() => {});
      const title = page.locator('.proj-hud__title');
      await expect(title).toBeHidden();

      // Where each project is in front: the stage docks, then one step
      // apiece. Measured live: late layout (web fonts swapping in) moves it
      const lane = () =>
        page.evaluate(() => {
          const tour = document.querySelector<HTMLElement>('.projects__tour')!;
          const stage = document.querySelector<HTMLElement>('.projects__stage')!;
          const docked =
            tour.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(stage).top);
          return { y: scrollY, docked, step: (tour.offsetHeight - stage.offsetHeight) / 14 };
        });
      /** Scroll comes to rest with project `index` in front (software WebGL makes every step slow) */
      const restsOn = (index: number) =>
        expect
          .poll(
            async () => {
              const { y, docked, step } = await lane();
              return Math.abs(y - (docked + step * index)) < 6;
            },
            { timeout: 40_000, intervals: [400] }
          )
          .toBe(true);

      // Most of the way to the first project: it glides the rest and docks
      const { width, height } = page.viewportSize()!;
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, (await lane()).docked * 0.7);
      await restsOn(0);
      await expect(title).toBeVisible();
      await expect(title).toHaveText('ZGS Carpentry');

      // A nudge past a project glides back to it, not to a point in between
      await page.mouse.wheel(0, 40);
      await restsOn(0);
      // Further than that carries on to the next, even well short of halfway
      await page.mouse.wheel(0, (await lane()).step * 0.3);
      await restsOn(1);
    }
  );

  test(
    'reacts to the pointer in open space only, so clicks in the modal stay in it',
    { tag: '@webgl' },
    async ({ page }) => {
      await openHydrated(page, '/projects');
      await page.waitForSelector('html:not([data-boot])', { state: 'attached', timeout: 120_000 });
      await page
        .locator('.brand-mark-live--3d')
        .waitFor({ state: 'attached', timeout: 60_000 })
        .catch(() => {});

      // A plain click on the index rides to that project: its screen in front, centred
      await page.locator('.projects a[href="/projects/zgs-carpentry"]').first().click();
      await expect(page.locator('.proj-hud__title')).toHaveText('ZGS Carpentry', {
        timeout: 40_000,
      });
      const root = page.locator('html');
      const { width, height } = page.viewportSize()!;
      const centre = { x: width / 2, y: height / 2 };

      // Over open space the screen in front takes the pointer (the world only
      // raycasts when the pointer moves, so keep nudging it while the camera settles)
      let nudge = 0;
      await expect
        .poll(
          async () => {
            nudge = 1 - nudge;
            await page.mouse.move(centre.x + nudge, centre.y);
            return root.getAttribute('data-world-hover');
          },
          { timeout: 40_000, intervals: [500] }
        )
        .not.toBeNull();

      await page.getByRole('link', { name: 'View details for ZGS Carpentry' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(/\/projects\/zgs-carpentry$/);

      // Over the dialog it doesn't, even with the screen right behind it
      await page.mouse.move(centre.x + 1, centre.y + 1);
      await expect(root).not.toHaveAttribute('data-world-hover');
      // Clicks there stay in the dialog (they used to open the project again,
      // stacking history entries that each needed a click on close)
      for (let i = 0; i < 3; i++) await page.mouse.click(centre.x, centre.y + i * 20);

      await page.getByRole('button', { name: 'Close project details' }).click();
      await expect(dialog).toBeHidden();
      await expect(page).toHaveURL(/\/projects$/);
    }
  );
});

test.describe('project pages', () => {
  test('render on a direct visit with breadcrumbs and neighbours', async ({ page }) => {
    const response = await page.goto('/projects/drive-king');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Drive King');
    await expect(page).toHaveTitle(/Drive King/);

    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/projects'
    );
    await expect(page.locator('a[rel="prev"]')).toHaveAttribute('href', '/projects/sidenote');
    const next = page.locator('a[rel="next"]');
    await expect(next).toHaveAttribute('href', '/projects/smiley-pets');

    await next.click();
    await expect(page).toHaveURL(/\/projects\/smiley-pets$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Smiley Pets');
  });

  test('describe the project in JSON-LD', async ({ page }) => {
    await page.goto('/projects/drive-king');
    const graphs = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) => scripts.map((s) => JSON.parse(s.textContent || '{}')));
    const nodes = graphs.flatMap((g) => g['@graph'] ?? [g]);
    const work = nodes.find((n) => n['@type'] === 'CreativeWork');
    expect(work?.name).toBe('Drive King');
    const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList');
    expect(crumbs?.itemListElement).toHaveLength(3);
  });

  test('unknown slugs are a 404', async ({ page }) => {
    const response = await page.goto('/projects/not-a-real-project');
    expect(response?.status()).toBe(404);
  });
});

test.describe('full-page screenshots', () => {
  test('are the ones content.json marks, however tall they are', async ({ page }) => {
    // Audi Form Builder's are full pages, though barely taller than wide
    await openHydrated(page, '/projects/audi-form-builder');
    const gallery = page.getByRole('region', { name: 'Audi Form Builder screenshots' });
    await expect(gallery.getByRole('region', { name: /Full-page screenshot/ })).toBeVisible();

    // AirDoctor's logo isn't
    await openHydrated(page, '/projects/airdoctor-webhook');
    const logo = page.getByRole('region', { name: 'AirDoctor Webhook screenshots' });
    await expect(logo.locator('.project-gallery__slide')).toBeVisible();
    await expect(logo.getByRole('region', { name: /Full-page screenshot/ })).toHaveCount(0);
  });

  test('show in a browser frame that scrolls itself and by hand', async ({ page }) => {
    await openHydrated(page, '/projects/drive-king');
    const gallery = page.getByRole('region', { name: 'Drive King screenshots' });
    await gallery.getByRole('button', { name: 'Next screenshot' }).click();

    // The slide it moved to: while they cross over, the one it left (a full
    // page too) is still there
    const slide = gallery.getByRole('group', { name: /^2 of / });
    const viewport = slide.getByRole('region', { name: /Full-page screenshot/ });
    await expect(viewport).toBeVisible();
    await expect(slide.locator('.page-shot__url')).toHaveText(/drive-king\.co\.uk/);
    // Wide, not a thin portrait strip
    const box = await viewport.boundingBox();
    expect(box && box.width > box.height).toBe(true);

    // Pans down on its own after a short pause
    const scrollTop = () => viewport.evaluate((el) => el.scrollTop);
    await expect.poll(scrollTop, { timeout: 8_000 }).toBeGreaterThan(100);

    // A wheel scroll hands control to the visitor
    await viewport.hover();
    await page.mouse.wheel(0, 600);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    const held = await scrollTop();
    await page.waitForTimeout(1500);
    expect(Math.abs((await scrollTop()) - held)).toBeLessThan(2);
  });
});
