import { expect, openHydrated, test } from './fixtures';

// The two tilted ticker bands must never overlap or push the page sideways
for (const [width, height] of [
  [390, 844],
  [1440, 900],
  [2560, 1200],
]) {
  test(`skills ticker bands stay apart at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/skills');
    const bands = page.locator('.skills__bands');
    await bands.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);

    const geometry = await page.evaluate(() => {
      // Rebuild each band's rotated top/bottom edge from its (rotation-invariant) centre
      const edge = (el: Element, side: 'top' | 'bottom') => {
        const box = el.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const m = new DOMMatrix(getComputedStyle(el).transform);
        const angle = Math.atan2(m.b, m.a);
        const half = (el as HTMLElement).offsetHeight / 2;
        return (x: number) =>
          cy + (side === 'bottom' ? half : -half) / Math.cos(angle) + Math.tan(angle) * (x - cx);
      };
      const a = document.querySelector('.skills__band--a')!;
      const b = document.querySelector('.skills__band--b')!;
      const vw = window.innerWidth;
      const aBottom = edge(a, 'bottom');
      const bTop = edge(b, 'top');
      return {
        gapLeft: bTop(0) - aBottom(0),
        gapRight: bTop(vw) - aBottom(vw),
        overflowX: document.documentElement.scrollWidth > vw,
      };
    });

    expect(geometry.gapLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.gapRight).toBeGreaterThanOrEqual(0);
    expect(geometry.overflowX).toBe(false);
  });
}

test.describe('skill evidence', () => {
  test.use({ reducedMotion: 'reduce' });

  test('published evidence replaces proficiency ratings and opens from the keyboard', async ({
    page,
  }) => {
    await openHydrated(page, '/skills');
    const react = page.getByRole('button', {
      name: 'Inspect React: 9 projects · 7 roles',
      exact: true,
    });
    await react.scrollIntoViewIfNeeded();
    await expect(react.locator('.skills__tile-evidence')).toHaveText('9 projects · 7 roles');
    await expect(
      page.getByRole('article', { name: 'Frontend', exact: true }).locator('.skills__proof')
    ).toHaveText('13 linked projects');
    await expect(page.locator('.skills__tile-level, .skills__gauge, .skills__avg')).toHaveCount(0);
    await react.focus();
    await page.keyboard.press('Enter');

    const inspector = page.getByRole('dialog', { name: 'React', exact: true });
    await expect(inspector).toBeVisible();
    await expect(page).toHaveURL(/inspect=skill%3AReact/);
    await expect(inspector.getByRole('button', { name: /Inspect project/ })).toHaveCount(9);
    await expect(inspector.getByRole('button', { name: /Read mission log/ })).toHaveCount(7);
    await expect(inspector.getByRole('button', { name: /^Sidenote / })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(inspector).toBeHidden();
    await expect(react).toBeFocused();
  });

  test('a listed tool without published evidence makes no invented project claim', async ({
    page,
  }) => {
    await openHydrated(page, '/skills');
    const linux = page.getByRole('button', { name: 'Inspect Linux: Explore skill', exact: true });
    await linux.click();
    const inspector = page.getByRole('dialog', { name: 'Linux', exact: true });
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText('a specific project or role is not documented yet');
    await expect(
      inspector.getByRole('button', { name: /Inspect project|Read mission log/ })
    ).toHaveCount(0);
    await expect(inspector.getByRole('link', { name: /Browse the toolkit/ })).toHaveAttribute(
      'href',
      '/skills'
    );
  });
});
