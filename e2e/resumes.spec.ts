import { test, expect } from '@playwright/test';

test.describe('Resumes Page', () => {
  test('resumes list page loads', async ({ page }) => {
    await page.goto('/dashboard/resumes');
    await page.waitForLoadState('networkidle');

    // Should show either resumes or empty state
    const body = await page.textContent('body');
    const hasContent = body?.includes('resume') || body?.includes('Resume') || body?.includes('Create');
    expect(hasContent).toBe(true);
  });

  test('no console errors on resumes page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/dashboard/resumes');
    await page.waitForLoadState('networkidle');

    const critical = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('Failed to load resource') &&
      !e.includes('Download the React DevTools') &&
      !e.includes('Third-party cookie')
    );
    expect(critical).toEqual([]);
  });
});
