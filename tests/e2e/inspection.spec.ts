import { test, expect, openHydrated } from './fixtures';

test.use({ reducedMotion: 'reduce' });

test('project inspection keeps canonical reading links and closes without losing the page', async ({
  page,
}) => {
  await openHydrated(page, '/projects?source=inspection-test&inspect=project:sidenote#portfolio');
  const inspector = page.getByRole('dialog', { name: 'Sidenote', exact: true });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole('link', { name: /case study/i })).toHaveAttribute(
    'href',
    '/projects/sidenote'
  );
  await inspector.getByRole('button', { name: 'Close inspection' }).click();
  await expect(inspector).toBeHidden();
  await expect(page).toHaveURL(/source=inspection-test/);
  await expect(page).toHaveURL(/#portfolio$/);
  expect(new URL(page.url()).searchParams.has('inspect')).toBe(false);
});

test('the sector chart works with the world switched off', async ({ page }) => {
  await openHydrated(page, '/');
  const trigger = page.getByRole('button', { name: 'Sector chart', exact: true });
  await trigger.click();
  const chart = page.getByRole('dialog', { name: 'Sector chart', exact: true });
  await expect(chart).toBeVisible();
  await chart.getByRole('button', { name: /^Projects, Fabrication yard/ }).click();
  await expect(chart.getByRole('button', { name: 'Travel to Projects' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(chart).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('inspection participates in Back and Forward and returns keyboard focus', async ({ page }) => {
  await openHydrated(page, '/projects');
  const projectIndex = page.getByRole('navigation', { name: 'Projects', exact: true });
  const firstProject = projectIndex.getByRole('link', { name: 'ZGS Carpentry', exact: true });
  await firstProject.click();
  await expect(firstProject).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.projects__stage')).not.toHaveAttribute('data-waiting');
  const trigger = page.getByRole('button', { name: 'Inspect project ZGS Carpentry', exact: true });
  await expect(trigger).toBeInViewport({ ratio: 1 });
  const scrollY = await page.evaluate(() => window.scrollY);
  await trigger.click();
  const inspector = page.getByRole('dialog', { name: 'ZGS Carpentry', exact: true });
  await expect(inspector).toBeVisible();
  await page.goBack();
  await expect(inspector).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(firstProject).toHaveAttribute('aria-current', 'true');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scrollY, 0);
  await page.goForward();
  await expect(inspector).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(inspector).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Sidenote explains a citation with an interactive source passage', async ({ page }) => {
  await openHydrated(page, '/projects?inspect=project:sidenote');
  const inspector = page.getByRole('dialog', { name: 'Sidenote', exact: true });
  await inspector.getByRole('tab', { name: 'How it works' }).click();
  const citation = inspector.getByRole('button', {
    name: 'Citation 1: highlight the source passage',
  });
  await citation.click();
  await expect(citation).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector.getByRole('status')).toHaveText(
    'Citation 1 highlighted in the source document.'
  );
  await expect(inspector.locator('mark')).toHaveClass(/passage--active/);
  await inspector.getByRole('button', { name: 'Previous step' }).click();
  await expect(citation).toHaveAttribute('aria-pressed', 'false');
});

test('unknown inspection IDs leave the portfolio usable', async ({ page }) => {
  await openHydrated(page, '/?inspect=project:missing-project&source=keep');
  await expect(page.locator('[data-inspection-panel]')).toHaveCount(0);
  await expect(page.locator('#main-content')).not.toHaveAttribute('inert', '');
  await expect(page).toHaveURL(/source=keep/);
});

test('a reading link to the current page exits inspection', async ({ page }) => {
  await openHydrated(page, '/skills?inspect=skill:React');
  const inspector = page.getByRole('dialog', { name: 'React', exact: true });
  await expect(inspector).toBeVisible();
  await inspector.getByRole('link', { name: 'Browse the toolkit' }).click();
  await expect(inspector).toBeHidden();
  await expect(page).toHaveURL(/\/skills$/);
  await expect(page.locator('#main-content')).not.toHaveAttribute('inert', '');
});

test('skill evidence changes the inspected artifact without adding another history step', async ({
  page,
}) => {
  await openHydrated(page, '/skills?inspect=skill:React');
  const skill = page.getByRole('dialog', { name: 'React', exact: true });
  await expect(skill).toBeVisible();
  const historyLength = await page.evaluate(() => window.history.length);
  await skill.getByRole('button', { name: /^Sidenote/ }).click();
  await expect(page.getByRole('dialog', { name: 'Sidenote', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/inspect=project%3Asidenote/);
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
});

test('calm travel is remembered without changing the world preference', async ({ page }) => {
  await openHydrated(page, '/');
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  const preferences = page.getByRole('dialog', { name: 'Preferences', exact: true });
  await preferences.getByRole('radio', { name: 'Calm', exact: true }).check();
  expect(await page.evaluate(() => localStorage.getItem('world'))).toBe('off');
  await preferences.getByRole('button', { name: 'Close console' }).click();
  await page.reload();
  await page.waitForSelector('body[data-theme]', { state: 'attached' });
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(preferences.getByRole('radio', { name: 'Calm', exact: true })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-world', 'off');
});

test('the ship log does not reveal undiscovered transmissions', async ({ page }) => {
  await openHydrated(page, '/');
  await page.getByRole('button', { name: 'Ship log', exact: true }).click();
  const log = page.getByRole('dialog', { name: 'Ship log', exact: true });
  await expect(log).toContainText('No transmissions recorded yet');
  await expect(log.locator('details')).toHaveCount(0);
});

test('the contact console preserves distinct fields through failed transmissions and retry', async ({
  page,
}) => {
  let attempts = 0;
  await page.route('**/api/sendmail', (route) => {
    attempts += 1;
    if (attempts === 1) return route.abort('failed');
    return route.fulfill({ status: attempts === 2 ? 429 : 200, body: '{}' });
  });
  await openHydrated(page, '/contact?inspect=station:contact');
  const console = page.getByRole('dialog', { name: 'Comms terminal', exact: true });
  await console.getByLabel('First name').fill('Ada');
  await console.getByLabel('Last name').fill('Lovelace');
  await console.getByLabel('Email address').fill('ada@example.com');
  await console.getByLabel('Message').fill('Please tell me more about this portfolio project.');
  const ids = await page
    .locator('input[id], textarea[id]')
    .evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(ids).size).toBe(ids.length);
  await console.getByRole('button', { name: 'Send Message', exact: true }).click();
  await expect(console.getByRole('alert')).toContainText('There was a problem sending the message');
  await expect(console.getByLabel('Message')).toHaveValue(
    'Please tell me more about this portfolio project.'
  );
  await console.getByRole('button', { name: 'Send Message', exact: true }).click();
  await expect(console.getByRole('alert')).toContainText('Slow down, space traveller');
  await expect(console.getByLabel('Message')).toHaveValue(
    'Please tell me more about this portfolio project.'
  );
  await console.getByRole('button', { name: 'Send Message', exact: true }).click();
  await expect(console.getByRole('status')).toContainText('Message sent!');
  await console.getByRole('button', { name: 'Send another message', exact: true }).click();
  await expect(console.getByLabel('First name')).toHaveValue('');
  expect(attempts).toBe(3);
});

test('the inspector traps focus and supports arrow-key tabs', async ({ page }) => {
  await openHydrated(page, '/projects?inspect=project:sidenote');
  const inspector = page.getByRole('dialog', { name: 'Sidenote', exact: true });
  const close = inspector.getByRole('button', { name: 'Close inspection' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(inspector.getByRole('link', { name: /Visit project/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(inspector.getByRole('tab', { name: 'Brief', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  const explanation = inspector.getByRole('tab', { name: 'How it works', exact: true });
  await expect(explanation).toBeFocused();
  await expect(explanation).toHaveAttribute('aria-selected', 'true');
});

test('screenshots are selected and scrolled manually', async ({ page }) => {
  await openHydrated(page, '/projects?inspect=project:zgs-carpentry');
  const inspector = page.getByRole('dialog', { name: 'ZGS Carpentry', exact: true });
  await inspector.getByRole('tab', { name: 'Screenshots', exact: true }).click();
  await inspector.getByRole('button', { name: 'Show screenshot 2', exact: true }).click();
  await expect(
    inspector.getByRole('button', { name: 'Show screenshot 2', exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    inspector.getByRole('button', { name: 'Show screenshot 1', exact: true })
  ).toHaveAttribute('aria-pressed', 'false');
  const position = inspector.getByRole('slider', { name: 'Page position', exact: true });
  await expect(position).toHaveValue('0');
  await position.focus();
  await page.keyboard.press('End');
  await expect(position).toHaveValue('100');
  await expect
    .poll(() =>
      inspector
        .getByLabel('Scrollable full-page screenshot', { exact: true })
        .evaluate((element) => element.scrollTop)
    )
    .toBeGreaterThan(0);
  await inspector.getByRole('button', { name: 'Show screenshot 1', exact: true }).click();
  await expect(position).toHaveValue('0');
});

test('the Audi explanation assembles and removes illustrative modules', async ({ page }) => {
  await openHydrated(page, '/projects?inspect=project:audi-form-builder');
  const inspector = page.getByRole('dialog', { name: 'Audi Form Builder', exact: true });
  await inspector.getByRole('tab', { name: 'How it works', exact: true }).click();
  const addDetails = inspector.getByRole('button', { name: '+ Your details', exact: true });
  await addDetails.click();
  await expect(addDetails).toBeDisabled();
  await inspector.getByRole('button', { name: 'Remove Your details module', exact: true }).click();
  await expect(addDetails).toBeEnabled();
  await expect(inspector).toContainText('Choose a module to add it to this sample form.');
});

test('the inspection panel fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHydrated(page, '/projects?inspect=project:sidenote');
  const inspector = page.getByRole('dialog', { name: 'Sidenote', exact: true });
  await expect(inspector).toBeVisible();
  const bounds = await inspector.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await inspector.getByRole('tab', { name: 'How it works' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
