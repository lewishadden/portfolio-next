import { contactLimits, honeypotField } from '../../utils/contactValidation';

import { expect, test } from './fixtures';

// The limiter is keyed by client IP (and remembers across runs against a
// long-lived server) — give every test its own address
let ipCounter = 0;
const headersFor = () => ({
  'x-forwarded-for': `10.${process.pid % 250}.${test.info().workerIndex % 250}.${++ipCounter}`,
});

const human = () => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  message: 'Hello from the test suite',
  startedAt: Date.now() - 60_000,
  [honeypotField]: '',
});

test.describe('POST /api/sendmail', () => {
  test('rejects invalid fields with per-field errors', async ({ request }) => {
    const response = await request.post('/api/sendmail', {
      headers: headersFor(),
      data: { ...human(), email: 'not-an-email', message: 'x'.repeat(contactLimits.message + 1) },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(Object.keys(body.errors).sort()).toEqual(['email', 'message']);
  });

  test('rejects malformed JSON', async ({ request }) => {
    const response = await request.post('/api/sendmail', {
      headers: { ...headersFor(), 'content-type': 'application/json' },
      data: '{"firstName":',
    });
    expect(response.status()).toBe(400);
  });

  test('rejects oversized bodies', async ({ request }) => {
    const response = await request.post('/api/sendmail', {
      headers: headersFor(),
      data: { ...human(), padding: 'x'.repeat(contactLimits.body) },
    });
    expect(response.status()).toBe(413);
  });

  test('quietly drops honeypot and too-fast submissions', async ({ request }) => {
    const headers = headersFor();
    const trapped = await request.post('/api/sendmail', {
      headers,
      data: { ...human(), [honeypotField]: 'Acme Ltd' },
    });
    expect(trapped.status()).toBe(200);
    const hurried = await request.post('/api/sendmail', {
      headers,
      data: { ...human(), startedAt: Date.now() },
    });
    expect(hurried.status()).toBe(200);
  });

  test('rate limits each visitor', async ({ request }) => {
    const headers = headersFor();
    // Honeypot submissions still count, and never send mail
    const bot = { ...human(), [honeypotField]: 'x' };
    for (let i = 0; i < 5; i += 1) {
      expect((await request.post('/api/sendmail', { headers, data: bot })).status()).toBe(200);
    }
    const limited = await request.post('/api/sendmail', { headers, data: bot });
    expect(limited.status()).toBe(429);
    expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0);
  });
});

test('the contact form explains missing fields', async ({ page }) => {
  await page.goto('/contact');
  // The form is code-split; click() waits for it to hydrate and scrolls it into view
  await page.locator('.contact-form__submit').click();
  await expect(page.locator('#formFirstName-error')).toHaveText('Enter your first name');
  // Screen readers get a single summary of everything that needs fixing
  await expect(page.locator('.contact-form [aria-live="assertive"]')).toContainText('4 errors');
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(4);
});
