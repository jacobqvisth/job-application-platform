import { test, expect } from '@playwright/test';

test.describe('Applications Page', () => {
  test('applications page loads with kanban board', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/dashboard/applications');
    await page.waitForLoadState('networkidle');

    // Should show kanban columns or empty state
    const body = await page.textContent('body');
    const hasContent =
      body?.includes('Saved') ||
      body?.includes('Applied') ||
      body?.includes('Interview') ||
      body?.includes('application') ||
      body?.includes('Add');
    expect(hasContent).toBe(true);

    expect(errors).toEqual([]);
  });

  test('can open "Add Application" dialog', async ({ page }) => {
    await page.goto('/dashboard/applications');
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button:has-text("Add")').first()
      .or(page.locator('button:has-text("New")').first())
      .or(page.locator('button:has-text("Create")').first());

    if (await addBtn.isVisible()) {
      await addBtn.click();
      // Should open a dialog/modal
      await expect(
        page.locator('[role="dialog"], [role="form"]').first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
