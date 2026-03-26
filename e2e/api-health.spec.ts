import { test, expect } from '@playwright/test';

// These tests verify unauthenticated API behavior — clear session state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('API Health Checks', () => {
  test('resume parse endpoint rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/resume/parse', {
      multipart: {},
    });
    // Should return 401 (unauthorized) or 400 (bad request), NOT 500
    expect([400, 401]).toContain(response.status());
  });

  test('resume list endpoint requires auth', async ({ request }) => {
    const response = await request.get('/api/resume/list');
    // Should return 401 (unauthorized), NOT 500
    expect([401, 403]).toContain(response.status());
  });

  test('gmail sync endpoint requires auth', async ({ request }) => {
    const response = await request.post('/api/gmail/sync');
    expect([401, 403]).toContain(response.status());
  });

  test('cron endpoint requires secret', async ({ request }) => {
    const response = await request.get('/api/cron/sync-emails');
    // Should reject without CRON_SECRET
    expect([401, 403, 405]).toContain(response.status());
  });
});
