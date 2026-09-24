import { expect, test } from '@playwright/test';

test('log a shelf price and link a list item to the product', async ({ page }) => {
  // Sign up and onboard.
  await page.goto('/signup');
  await page.getByLabel('Name').fill('Ayanda');
  await page.getByLabel('Email').fill(`ayanda-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Province').selectOption('Gauteng');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Hi Ayanda' })).toBeVisible();

  // Add a store and a loyalty card.
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Shop', { exact: true }).selectOption('shoprite');
  const which = page.getByLabel('Which one?', { exact: true });
  if (await which.isVisible()) await which.selectOption('new');
  const storeName = `Shoprite E2E ${Date.now()}`;
  await page.getByLabel('Store name', { exact: true }).fill(storeName);
  await page.getByLabel('Suburb or area', { exact: true }).fill('Braamfontein');
  await page.getByRole('button', { name: 'Add store' }).click();
  await expect(page.getByRole('button', { name: `Remove ${storeName}` })).toBeVisible();
  await page.getByRole('checkbox', { name: /Xtra Savings/ }).check();
  await expect(page.getByRole('checkbox', { name: /Xtra Savings/ })).toBeChecked();

  // Log a price, searching by brand and pack size.
  await page.goto('/prices/new');
  await page.getByLabel('Search products', { exact: true }).fill('tastic 2kg');
  await page.getByRole('button', { name: /Tastic Long Grain Parboiled Rice.*2 kg/ }).click();
  await page
    .getByLabel('Where did you see it?')
    .selectOption({ label: `${storeName} — Braamfontein` });
  await page.getByLabel(/^Price for/).fill('45,99');
  await page.getByLabel('Member price (R)').fill('41.99');
  await page.getByRole('button', { name: 'Save price' }).click();

  // The product page shows it, with the member price because the user has the card.
  await expect(page.getByText('Thanks! Your price is saved')).toBeVisible();
  await expect(page.getByText('R45.99')).toBeVisible();
  await expect(page.getByText('R41.99 with card ✓')).toBeVisible();
  await expect(page.getByText('R2.30/100 g')).toBeVisible();

  // Link a list item to the exact product via suggestions; it's grouped by aisle.
  await page.goto('/lists');
  await page.getByLabel('New list name').fill('Weekly');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByLabel('Item', { exact: true }).fill('tastic');
  await page.getByRole('option', { name: /Tastic Long Grain Parboiled Rice.*2 kg/ }).click();
  await expect(page.getByRole('region', { name: 'Maize meal, rice & grains' })).toContainText(
    'Tastic Long Grain Parboiled Rice 2 kg',
  );
  await page.getByRole('link', { name: 'See prices' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tastic Long Grain Parboiled Rice' }),
  ).toBeVisible();
});
