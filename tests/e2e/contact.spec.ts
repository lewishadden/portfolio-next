import {
  contactLimits,
  honeypotField,
  validateContactPayload,
} from '../../utils/contactValidation';

import { expect, openHydrated, test } from './fixtures';

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
  elapsedMs: 60_000,
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
      data: { ...human(), elapsedMs: 0 },
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

test.describe('telling people from bots', () => {
  test("goes by how long the form was open, never by the visitor's clock", () => {
    expect(validateContactPayload(human())).toMatchObject({ ok: true, bot: false });
    expect(
      validateContactPayload({ ...human(), elapsedMs: contactLimits.minFillMs - 1 })
    ).toMatchObject({ ok: true, bot: 'too-fast' });
    // Nothing to go by (a script posting straight to the API) counts as too fast
    expect(validateContactPayload({ ...human(), elapsedMs: undefined })).toMatchObject({
      ok: true,
      bot: 'too-fast',
    });
    expect(validateContactPayload({ ...human(), [honeypotField]: 'Acme Ltd' })).toMatchObject({
      ok: true,
      bot: 'honeypot',
    });
  });

  test('a page open since before this shipped still sends when its form appeared', () => {
    const now = Date.now();
    const old = { ...human(), elapsedMs: undefined };
    expect(validateContactPayload({ ...old, startedAt: now - 60_000 }, now)).toMatchObject({
      ok: true,
      bot: false,
    });
    expect(validateContactPayload({ ...old, startedAt: now }, now)).toMatchObject({
      ok: true,
      bot: 'too-fast',
    });
  });
});

test('the contact form says how long it was open, not what its clock reads', async ({ page }) => {
  // A device clock running fast put the form's start in the server's future:
  // a real message then looked like a bot's and was dropped without a word
  let posted: Record<string, unknown> | null = null;
  await page.route('**/api/sendmail', async (route) => {
    posted = route.request().postDataJSON();
    await route.fulfill({ json: { message: 'Email sent successfully' } });
  });
  await openHydrated(page, '/contact');
  await page.waitForLoadState('networkidle');
  await page.locator('#formFirstName').fill('Ada');
  await page.locator('#formLastName').fill('Lovelace');
  await page.locator('#formEmail').fill('ada@example.com');
  await page.locator('#formMessage').fill('Hello from the test suite');
  await page.locator('.contact-form__submit').click();
  await expect(page.locator('.contact__toast--success')).toBeVisible();

  expect(posted).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', [honeypotField]: '' });
  const { elapsedMs } = posted!;
  expect(typeof elapsedMs).toBe('number');
  expect(elapsedMs as number).toBeGreaterThanOrEqual(0);
  expect(elapsedMs as number).toBeLessThan(60_000);
  expect(posted).not.toHaveProperty('startedAt');
});

test('the contact form explains missing fields', async ({ page }) => {
  await openHydrated(page, '/contact');
  // The form is code-split: let its chunk arrive and hydrate before submitting
  await page.waitForLoadState('networkidle');
  await page.locator('.contact-form__submit').click();
  await expect(page.locator('#formFirstName-error')).toHaveText('Enter your first name');
  // Screen readers get a single summary of everything that needs fixing
  await expect(page.locator('.contact-form [aria-live="assertive"]')).toContainText('4 errors');
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(4);
});
