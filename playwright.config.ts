import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT || 3100);
// Point at an already running server (e.g. `npm run dev`) instead of starting one
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseUrl || `http://localhost:${port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

/**
 * End-to-end tests against a production build: run `npm run build` first,
 * then `npm run test:e2e` (the server is started for you). Set
 * PLAYWRIGHT_CHROMIUM_PATH to use an existing Chromium binary.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      grepInvert: /@webgl/,
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
    {
      // Only tests tagged @webgl get software WebGL: with these flags recent
      // Chrome stalls every other navigation for seconds, which starves the
      // rest of the suite on CI machines
      name: 'chromium-webgl',
      grep: /@webgl/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath,
          args: [
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npm run start -- -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
