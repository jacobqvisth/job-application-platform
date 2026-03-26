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

  test('application draft endpoint requires auth', async ({ request }) => {
    const response = await request.post('/api/application/draft', {
      data: { jobDescription: 'Test' },
    });
    expect(response.status()).toBe(401);
  });

  test('application save-draft endpoint requires auth', async ({ request }) => {
    const response = await request.post('/api/application/save-draft', {
      data: { company: 'Test', role: 'Test', jobDescription: 'Test', coverLetter: '', screeningAnswers: [] },
    });
    expect(response.status()).toBe(401);
  });

  test('application improve endpoint requires auth', async ({ request }) => {
    const response = await request.post('/api/application/improve', {
      data: { type: 'cover_letter', content: 'Test', instruction: 'shorter', jobDescription: 'Test' },
    });
    expect(response.status()).toBe(401);
  });
});
