import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('accessibility (WCAG 2.1 AA)', () => {
  test('home has no critical violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    if (critical.length > 0) console.log(JSON.stringify(critical.map((v) => v.id), null, 1));
    expect(critical).toEqual([]);
  });

  test('booking flow has no critical violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const href = await page.getByRole('link', { name: 'Book your chair' }).first().getAttribute('href');
    await page.goto(href!);
    await page.waitForTimeout(2500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    if (critical.length > 0) console.log(JSON.stringify(critical.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 1));
    expect(critical).toEqual([]);
  });
});
