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

test('each category is one tab stop, and the arrow keys move between its tiles', async ({
  page,
}) => {
  await openHydrated(page, '/skills');
  const lists = page.locator('#main-content .skills__tiles');
  const categories = await page.locator('#main-content [data-world-category]').count();
  await expect(page.locator('#main-content .skills__tile[tabindex="0"]')).toHaveCount(categories);

  const first = lists.nth(0).locator('.skills__tile');
  const second = lists.nth(1).locator('.skills__tile');
  await first.nth(0).focus();
  await expect(first.nth(0)).toHaveAccessibleDescription(/^Proficiency \d+%$/);

  // Tab leaves the category, Shift+Tab comes back to it
  await page.keyboard.press('Tab');
  await expect(second.nth(0)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(first.nth(0)).toBeFocused();

  // → and ← move between its tiles, and the tile left is where Tab comes back to
  await page.keyboard.press('ArrowRight');
  await expect(first.nth(1)).toBeFocused();
  await expect(first.nth(1)).toHaveAttribute('tabindex', '0');
  await expect(first.nth(0)).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('ArrowLeft');
  await expect(first.nth(0)).toBeFocused();
  await page.keyboard.press('End');
  await expect(first.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first.nth(0)).toBeFocused();

  // ↓ and ↑ move a row, to the tile in the same column, while the focused
  // tile is lifted as hover lifts it (its lift once made ↓ move sideways)
  const lifted = 'matrix(1, 0, 0, 1, 0, -4)';
  const columns = await first.evaluateAll((tiles) => {
    const top = (tile: Element) => (tile.parentElement as HTMLElement).offsetTop;
    return tiles.filter((tile) => top(tile) === top(tiles[0])).length;
  });
  expect(await first.count()).toBeGreaterThan(columns);
  await expect(first.nth(0)).toHaveCSS('transform', lifted);
  await page.keyboard.press('ArrowDown');
  await expect(first.nth(columns)).toBeFocused();
  await expect(first.nth(columns)).toHaveCSS('transform', lifted);
  await page.keyboard.press('ArrowUp');
  await expect(first.nth(0)).toBeFocused();
  // ↓ on the last row stays put
  await page.keyboard.press('End');
  await expect(first.last()).toHaveCSS('transform', lifted);
  await page.keyboard.press('ArrowDown');
  await expect(first.last()).toBeFocused();
});
