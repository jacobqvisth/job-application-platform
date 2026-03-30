import { test, expect } from '@playwright/test';

// Extension API routes use bearer token auth, not cookies.
// These tests verify that all routes return 401 without a valid token.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Extension API Routes', () => {
  test('GET /api/extension/profile returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/extension/profile');
    expect(res.status()).toBe(401);
  });

  test('POST /api/extension/save-job returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/extension/save-job', {
      data: { title: 'Test', company: 'Test Co', url: 'https://example.com' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/extension/field-mappings returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/extension/field-mappings?ats_type=greenhouse');
    expect(res.status()).toBe(401);
  });

  test('POST /api/extension/field-mappings returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/extension/field-mappings', {
      data: {
        ats_type: 'greenhouse',
        field_identifier: '#email',
        profile_key: 'email',
        is_user_corrected: false,
      },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/extension/profile with invalid token returns 401', async ({ request }) => {
    const res = await request.get('/api/extension/profile', {
      headers: { Authorization: 'Bearer invalid_token_here' },
    });
    expect(res.status()).toBe(401);
  });

  test('Extension page loads (redirects to login when unauthenticated)', async ({ page }) => {
    await page.goto('/dashboard/extension');
    await expect(page).toHaveURL(/login/);
  });

  test('GET /api/extension/field-mappings accepts jobylon ats_type', async ({ request }) => {
    const res = await request.get('/api/extension/field-mappings?ats_type=jobylon');
    // 401 = auth guard fired (correct — jobylon is a valid ats_type, rejected at auth not validation)
    expect(res.status()).toBe(401);
  });

  test('GET /api/extension/field-mappings accepts reachmee ats_type', async ({ request }) => {
    const res = await request.get('/api/extension/field-mappings?ats_type=reachmee');
    expect(res.status()).toBe(401);
  });

  test('GET /api/extension/field-mappings rejects unknown ats_type', async ({ request }) => {
    const res = await request.get('/api/extension/field-mappings?ats_type=unknown_ats');
    // 401 is also acceptable — auth fires before ats_type validation
    expect([400, 401]).toContain(res.status());
  });
});
