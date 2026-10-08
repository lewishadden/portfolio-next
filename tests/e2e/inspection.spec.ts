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
