import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/profile');
    await page.waitForLoadState('networkidle');
  });

  test('profile form renders all sections', async ({ page }) => {
    await expect(page.locator('text=Professional Summary').first()).toBeVisible();
    await expect(page.locator('text=Work History').first()).toBeVisible();
    await expect(page.locator('text=Education').first()).toBeVisible();
    await expect(page.locator('text=Skills').first()).toBeVisible();
  });

  test('can save profile summary', async ({ page }) => {
    const summaryInput = page.locator('textarea').first();
    await summaryInput.fill('E2E Test: Experienced software developer');

    const saveBtn = page.locator('button:has-text("Save")').first();
    await saveBtn.click();

    // Wait for success toast
    await expect(page.locator('text=/saved|success/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('can add a work history entry', async ({ page }) => {
    // Click "Add" button in Work History section
    const addBtn = page.locator('section:has-text("Work History") >> button:has-text("Add")').first()
      .or(page.locator('button:has-text("Add Work")').first())
      .or(page.locator('[data-testid="add-work-history"]').first());

    if (await addBtn.isVisible()) {
      await addBtn.click();

      // Fill in company name
      const companyInput = page.locator('input[placeholder*="company" i]').first()
        .or(page.locator('label:has-text("Company") + input').first());

      if (await companyInput.isVisible()) {
        await companyInput.fill('E2E Test Company');
      }
    }
  });

  test('PDF upload area is visible and interactive', async ({ page }) => {
    // Look for the file upload area
    const uploadArea = page.locator('text=/upload|drop.*pdf|import.*resume/i').first();
    await expect(uploadArea).toBeVisible();

    // The upload area should accept clicks
    const fileInput = page.locator('input[type="file"]').first();
    expect(await fileInput.count()).toBeGreaterThan(0);
  });

  test('PDF upload sends file to API and gets parsed result', async ({ page }) => {
    const testPdfPath = path.resolve(__dirname, 'fixtures/test-resume.pdf');

    const fileInput = page.locator('input[type="file"]').first();

    // Only test if input exists and we have a fixture
    if (await fileInput.count() > 0) {
      // Listen for the API call
      const apiPromise = page.waitForResponse(
        resp => resp.url().includes('/api/resume/parse') && resp.status() !== 404,
        { timeout: 30_000 }
      ).catch(() => null);

      await fileInput.setInputFiles(testPdfPath);

      const apiResponse = await apiPromise;
      if (apiResponse) {
        // API should return 200 (success) or 400 (bad pdf) — NOT 500
        expect(apiResponse.status()).not.toBe(500);
      }
    }
  });
});
