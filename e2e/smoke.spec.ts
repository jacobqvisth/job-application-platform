import { test, expect } from '@playwright/test';

test.describe('Smoke Tests — Public Pages', () => {
  test('login page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/login');
    await expect(page).toHaveTitle(/Job Application/i);
    await expect(page.locator('text=/sign in|log in|google/i').first()).toBeVisible();

    // No critical console errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('hydration')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('unauthenticated users are redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login**', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated users cannot access protected routes', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard/applications',
      '/dashboard/resumes',
      '/dashboard/profile',
      '/dashboard/settings',
      '/dashboard/emails',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL('**/login**', { timeout: 10_000 });
      expect(page.url()).toContain('/login');
    }
  });
});
