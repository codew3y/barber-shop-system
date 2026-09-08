import { test, expect } from '@playwright/test';

function nextWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

test('guest books end-to-end and tracks in dashboard', async ({ page }) => {
  const email = `e2e${Date.now()}@example.com`;
  const date = nextWeekday();

  // Home → booking flow
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cuts & services' })).toBeVisible();
  await page.getByRole('link', { name: 'Book your chair' }).first().click();

  // Step 1: Barber & Service (no preselect on the plain flow)
  await page.getByRole('button', { name: /Classic Cut/ }).click();
  await page.getByRole('button', { name: /Alex Reyes/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2: time — set date, pick first available slot, continue
  await page.locator('input[type="date"]').fill(date);
  const slotButton = page.locator('button:not([disabled])', { hasText: /AM|PM/ }).first();
  await expect(slotButton).toBeVisible({ timeout: 15000 });
  await slotButton.click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4: guest checkout
  await page.getByPlaceholder('First name').fill('E2E');
  await page.getByPlaceholder('Last name').fill('Guest');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder(/Password/).fill('password123');
  await page.getByRole('button', { name: 'Reserve my chair' }).click();

  // Confirmation page
  await expect(page.getByRole('heading', { name: /Chair reserved/ })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Word from the house' })).toBeVisible();

  // Dashboard status tracking
  await page.getByRole('link', { name: 'Track in dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'My chairs' })).toBeVisible();
  await expect(page.getByText('Upcoming (1)')).toBeVisible();
});
