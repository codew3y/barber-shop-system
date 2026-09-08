import { test, expect } from '@playwright/test';

function nextWeekday(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('guest books end-to-end and tracks in dashboard', async ({ page }) => {
  const phone = `+1555${Date.now().toString().slice(-7)}`;
  const date = nextWeekday();

  // Home → booking flow
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cuts & services' })).toBeVisible();
  await page.getByRole('link', { name: 'Book your chair' }).first().click();

  // Step 1: Barber & Service (no preselect on the plain flow)
  await page.getByRole('button', { name: /Classic Cut/ }).click();
  await page.getByRole('button', { name: /Alex Reyes/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2: time — navigate calendar to target date, pick first available slot, continue
  const monthTitle = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  for (let i = 0; i < 3; i++) {
    const title = await page.getByTestId('cal-title').textContent();
    if (title?.trim() === monthTitle) break;
    await page.getByRole('button', { name: 'Next month' }).click();
  }
  await page.getByTestId(`day-${toISO(date)}`).click();
  const slotButton = page.locator('button:not([disabled])', { hasText: /AM|PM/ }).first();
  await expect(slotButton).toBeVisible({ timeout: 15000 });
  await slotButton.click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4: guest checkout (phone only, no password)
  await page.getByPlaceholder('First name').fill('E2E');
  await page.getByPlaceholder('Last name').fill('Guest');
  await page.getByPlaceholder('Phone number').fill(phone);
  await page.getByRole('button', { name: 'Reserve my chair' }).click();

  // Confirmation page
  await expect(page.getByRole('heading', { name: /Chair reserved/ })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Word from the house' })).toBeVisible();

  // Dashboard status tracking
  await page.getByRole('link', { name: 'Track in dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'My chairs' })).toBeVisible();
  await expect(page.getByText('Upcoming (1)')).toBeVisible();
});
