import { expect, test } from './fixtures';

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
