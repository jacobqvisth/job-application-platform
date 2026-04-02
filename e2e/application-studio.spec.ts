import { test, expect } from '@playwright/test';

// ─── Public tests (no auth) ─────────────────────────────────────────
test.describe('Application Studio page', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/application-studio');
    await expect(page).toHaveURL(/login|dashboard\/chat/);
  });
});

// ─── API auth tests ─────────────────────────────────────────────────
test.describe('Application Studio API auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('POST /api/application-studio/analyze returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/application-studio/analyze', {
      data: { job_listing_id: 'test' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/application-studio/checkpoint-1 returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/application-studio/checkpoint-1', {
      data: { package_id: 'test' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/application-studio/nonexistent returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/application-studio/nonexistent');
    expect(res.status()).toBe(401);
  });
});

// ─── Authenticated tests ────────────────────────────────────────────
test.describe('Application Studio (authenticated)', () => {
  test.use({ storageState: './e2e/.auth/user.json' });

  test('redirects to chat when no job or package query param', async ({ page }) => {
    await page.goto('/dashboard/application-studio');
    await expect(page).toHaveURL(/dashboard\/chat/);
  });

  test('page loads via nav rail link', async ({ page }) => {
    await page.goto('/dashboard/chat');
    // Application Studio should be in the nav rail
    const navLink = page.locator('a[href="/dashboard/application-studio"]');
    await expect(navLink).toBeVisible();
  });

  test('POST /api/application-studio/analyze returns 400 without job_listing_id', async ({ request }) => {
    const res = await request.post('/api/application-studio/analyze', {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/application-studio/checkpoint-1 returns 400 without package_id', async ({ request }) => {
    const res = await request.post('/api/application-studio/checkpoint-1', {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});
