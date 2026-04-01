import { test, expect, type Page } from '@playwright/test';

// Helper: collect console errors during test
function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

test.describe('Job Leads', () => {

  // ─── Page Tests (authenticated) ─────────────────────────────────────────

  test.describe('Authenticated', () => {

    test('job leads page loads without console errors', async ({ page }) => {
      const errors = trackConsoleErrors(page);
      await page.goto('/dashboard/job-leads');
      await page.waitForLoadState('networkidle');

      // Page should show the heading
      await expect(page.getByRole('heading', { name: 'Job Leads' })).toBeVisible();

      // No critical console errors
      const critical = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource') &&
        !e.includes('Download the React DevTools') &&
        !e.includes('Third-party cookie') &&
        !e.includes('CORS policy') &&
        !e.includes('accounts.google.com')
      );
      expect(critical).toEqual([]);
    });

    test('job leads page shows filter tabs', async ({ page }) => {
      await page.goto('/dashboard/job-leads');
      await page.waitForLoadState('networkidle');

      // Should have filter tab buttons
      await expect(page.getByRole('button', { name: /All/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Pending/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Approved/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Rejected/i })).toBeVisible();
    });

    test('job leads page shows empty state or leads table', async ({ page }) => {
      await page.goto('/dashboard/job-leads');
      await page.waitForLoadState('networkidle');

      // Either shows empty state message or has leads content
      const hasEmptyState = await page.getByText(/No job leads yet/i).isVisible().catch(() => false);
      const hasLeads = await page.getByText(/Pending|Approved|Rejected/i).first().isVisible().catch(() => false);
      expect(hasEmptyState || hasLeads).toBeTruthy();
    });

    test('filter tabs are clickable', async ({ page }) => {
      await page.goto('/dashboard/job-leads');
      await page.waitForLoadState('networkidle');

      // Click each filter tab — should not crash
      const tabs = ['Pending', 'Approved', 'Rejected', 'All'];
      for (const tab of tabs) {
        await page.getByRole('button', { name: new RegExp(tab, 'i') }).click();
        // Page should not show error
        const body = await page.textContent('body');
        expect(body).not.toContain('Application error');
      }
    });

    test('job leads page has search input', async ({ page }) => {
      await page.goto('/dashboard/job-leads');
      await page.waitForLoadState('networkidle');

      // Should have a search input
      const searchInput = page.getByPlaceholder(/search/i);
      await expect(searchInput).toBeVisible();
    });

    // JL2: auto-extract API smoke test (authenticated)
    test('POST /api/emails/extract-jobs with unknown emailId returns 404 not 500', async ({ request }) => {
      const response = await request.post('/api/emails/extract-jobs', {
        data: { emailId: '00000000-0000-0000-0000-000000000001' },
      });
      // 404: email not found. Must not be 500 (regression check for refactored route).
      expect(response.status()).toBe(404);
    });

  });

  // ─── Navigation Tests ──────────────────────────────────────────────────

  test.describe('Navigation', () => {

    test('sidebar contains Job Leads link', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Job Leads should be visible in the sidebar
      const jobLeadsLink = page.locator('a[title="Job Leads"], a[href*="/dashboard/job-leads"]').first();
      await expect(jobLeadsLink).toBeVisible();
    });

    test('clicking Job Leads in sidebar navigates to job leads page', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const jobLeadsLink = page.locator('a[title="Job Leads"], a[href*="/dashboard/job-leads"]').first();
      await jobLeadsLink.click();
      await page.waitForURL('**/dashboard/job-leads**', { timeout: 10_000 });
      expect(page.url()).toContain('/dashboard/job-leads');
    });

  });

  // ─── JL2: Sources section ─────────────────────────────────────────────

  test.describe('Sources section', () => {

    test('job leads page renders without error (sources section present or absent)', async ({ page }) => {
      await page.goto('/dashboard/job-leads');
      await page.waitForLoadState('networkidle');

      // Page must not show an application error regardless of whether sources exist
      const body = await page.textContent('body');
      expect(body).not.toContain('Application error');
    });

  });

  // ─── API Auth Tests (unauthenticated) ──────────────────────────────────

  test.describe('API auth checks', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('POST /api/emails/extract-jobs returns 401 when unauthenticated', async ({ request }) => {
      const response = await request.post('/api/emails/extract-jobs', {
        data: { emailId: '00000000-0000-0000-0000-000000000000' },
      });
      expect(response.status()).toBe(401);
    });

    test('POST /api/emails/reclassify returns 401 when unauthenticated', async ({ request }) => {
      const response = await request.post('/api/emails/reclassify', {
        data: { emailId: '00000000-0000-0000-0000-000000000000', classification: 'general' },
      });
      expect(response.status()).toBe(401);
    });

    test('GET /api/job-email-sources returns 401 when unauthenticated', async ({ request }) => {
      const response = await request.get('/api/job-email-sources');
      expect(response.status()).toBe(401);
    });

    test('POST /api/job-email-sources returns 401 when unauthenticated', async ({ request }) => {
      const response = await request.post('/api/job-email-sources', {
        data: {
          senderEmail: 'test@example.com',
          senderDomain: 'example.com',
          displayName: 'Test',
          isAutoExtract: false,
        },
      });
      expect(response.status()).toBe(401);
    });

    test('POST /api/emails/extract-jobs returns 400 or 401 for missing emailId', async ({ request }) => {
      const response = await request.post('/api/emails/extract-jobs', {
        data: {},
      });
      expect([400, 401]).toContain(response.status());
    });

    test('POST /api/emails/reclassify returns 400 or 401 for invalid classification', async ({ request }) => {
      const response = await request.post('/api/emails/reclassify', {
        data: { emailId: '00000000-0000-0000-0000-000000000000', classification: 'invalid_type' },
      });
      expect([400, 401]).toContain(response.status());
    });
  });
});
