import { test as base, expect } from '@playwright/test';

import type { Page } from '@playwright/test';

export interface SiteOptions {
  theme: 'dark' | 'light';
  /** 'off' skips the WebGL world (faster, and what most tests don't need) */
  world: 'on' | 'off';
}

/**
 * Seeds the visitor's saved preferences before every page load. Tests that
 * exercise the 3D world opt in with `test.use({ world: 'on' })`.
 */
export const test = base.extend<SiteOptions>({
  theme: ['dark', { option: true }],
  world: ['off', { option: true }],
  context: async ({ context, theme, world }, provide) => {
    await context.addInitScript(
      (prefs) => {
        try {
          localStorage.setItem('theme', prefs.theme);
          if (prefs.world === 'off') localStorage.setItem('world', 'off');
        } catch {
          // storage blocked — defaults apply
        }
      },
      { theme, world }
    );
    await provide(context);
  },
});

export { expect };

/** Scrolls through the page so every scroll-triggered reveal has played */
export async function revealAll(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.6));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
  // Reveals last 0.9s after entering the viewport
  await page.waitForTimeout(1200);
}

export const routes = ['/', '/about', '/experience', '/projects', '/skills', '/contact'];
