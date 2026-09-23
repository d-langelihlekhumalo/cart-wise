import { expect, test } from '@playwright/test';

test('a shopping list keeps working offline and syncs when back online', async ({
  page,
  context,
}) => {
  const email = `shopper-${Date.now()}@example.com`;

  // Sign up and onboard.
  await page.goto('/signup');
  await page.getByLabel('Name').fill('Lerato');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Province').selectOption('Gauteng');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Hi Lerato' })).toBeVisible();

  // Build a list.
  await page.getByRole('link', { name: 'Create a list' }).click();
  await page.getByLabel('New list name').fill('Month-end shop');
  await page.getByRole('button', { name: 'Create' }).click();
  for (const item of ['Maize meal 10kg', 'Sunflower oil 2L', 'Brown bread']) {
    await page.getByLabel('Item', { exact: true }).fill(item);
    await page.getByLabel('Item', { exact: true }).press('Enter');
  }
  await expect(page.getByText('Brown bread', { exact: true })).toBeVisible();

  // Make sure the service worker controls the page, so a reload works offline.
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready;
    return true;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // In the shop with no signal: reload, tick items.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Month-end shop' })).toBeVisible();
  await page.getByText('Maize meal 10kg', { exact: true }).click();
  await page.getByText('Brown bread', { exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /In the trolley/ })).toContainText('2');

  // Back online: changes reach the server.
  await context.setOffline(false);
  await expect
    .poll(async () => {
      const res = await page.request.get('/api/sync/pull?cursor=0');
      const body = (await res.json()) as { items: { text: string; checked: boolean }[] };
      return body.items
        .filter((i) => i.checked)
        .map((i) => i.text)
        .sort();
    })
    .toEqual(['Brown bread', 'Maize meal 10kg']);
});
