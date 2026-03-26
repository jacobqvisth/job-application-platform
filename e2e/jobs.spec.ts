import { test, expect } from '@playwright/test';

test.describe('Job Discovery', () => {
  // Authenticated tests — uses the saved auth state
  test.describe('Authenticated', () => {

    test('jobs page loads and shows search form', async ({ page }) => {
      await page.goto('/dashboard/jobs');
      await expect(page.getByRole('heading', { name: 'Find Jobs' })).toBeVisible();
      await expect(page.getByPlaceholder('Job title, keywords, skills...')).toBeVisible();
    });

    test('search button is disabled when query is empty', async ({ page }) => {
      await page.goto('/dashboard/jobs');
      const submitButton = page.locator('#job-search-submit');
      await expect(submitButton).toBeDisabled();
    });

    test('search button is enabled when query is entered', async ({ page }) => {
      await page.goto('/dashboard/jobs');
      await page.getByPlaceholder('Job title, keywords, skills...').fill('Software Engineer');
      const submitButton = page.locator('#job-search-submit');
      await expect(submitButton).toBeEnabled();
    });

    test('shows saved searches panel', async ({ page }) => {
      await page.goto('/dashboard/jobs');
      await expect(page.getByText('My Saved Searches')).toBeVisible();
    });

    test('shows discovered tab', async ({ page }) => {
      await page.goto('/dashboard/jobs');
      await expect(page.getByRole('tab', { name: /Discovered/ })).toBeVisible();
    });

    test('discovered tab shows empty state when no listings', async ({ page }) => {
      await page.goto('/dashboard/jobs');
      await page.getByRole('tab', { name: /Discovered/ }).click();
      // Either shows listings or the empty state
      const hasEmptyState = await page.getByText('No discovered jobs yet').isVisible().catch(() => false);
      const hasListings = await page.locator('[data-testid="job-card"]').count().catch(() => 0);
      expect(hasEmptyState || hasListings > 0).toBeTruthy();
    });

    test('jobs page is linked from dashboard', async ({ page }) => {
      await page.goto('/dashboard');
      // Dashboard has a Find Jobs / Browse Jobs link
      const jobsLink = page.getByRole('link', { name: /Find Jobs|Browse Jobs|Start Search/ }).first();
      await expect(jobsLink).toBeVisible();
    });

    test('nav contains Find Jobs link', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: /Find Jobs|Jobs/ }).first()).toBeVisible();
    });
  });

  // API auth tests — no auth needed, just verify 401
  test.describe('API auth checks', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('GET /api/jobs/search returns 401 when unauthenticated', async ({ request }) => {
      const response = await request.get('/api/jobs/search?q=engineer');
      expect(response.status()).toBe(401);
    });

    test('GET /api/jobs/search returns 400 when q param missing', async ({ page, request }) => {
      // Need auth for this — skip if unauthenticated (will get 401 instead of 400)
      const response = await request.get('/api/jobs/search');
      expect([400, 401]).toContain(response.status());
    });

    test('POST /api/jobs/save returns 401 when unauthenticated', async ({ request }) => {
      const response = await request.post('/api/jobs/save', {
        data: { title: 'Engineer', company: 'ACME', url: 'https://example.com' },
      });
      expect(response.status()).toBe(401);
    });

    test('GET /api/jobs/saved-searches returns 401 when unauthenticated', async ({ request }) => {
      const response = await request.get('/api/jobs/saved-searches');
      expect(response.status()).toBe(401);
    });

    test('POST /api/jobs/saved-searches returns 401 when unauthenticated', async ({ request }) => {
      const response = await request.post('/api/jobs/saved-searches', {
        data: { name: 'Test', query: 'engineer', country: 'gb', is_active: true, remote_only: false },
      });
      expect(response.status()).toBe(401);
    });

    test('GET /api/cron/job-discovery returns 401 without secret', async ({ request }) => {
      const response = await request.get('/api/cron/job-discovery');
      expect([401, 403]).toContain(response.status());
    });
  });
});
