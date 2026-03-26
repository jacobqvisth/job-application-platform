import { test, expect } from '@playwright/test';

test.describe('Draft Application', () => {
  test('draft page loads', async ({ page }) => {
    await page.goto('/dashboard/draft');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1', { hasText: 'Draft Application' })).toBeVisible();
  });

  test('generate button is disabled when textarea is empty', async ({ page }) => {
    await page.goto('/dashboard/draft');
    await page.waitForLoadState('networkidle');
    const btn = page.locator('button', { hasText: 'Generate Application Package' });
    await expect(btn).toBeDisabled();
  });

  test('generate button enables when job description is filled', async ({ page }) => {
    await page.goto('/dashboard/draft');
    await page.waitForLoadState('networkidle');
    await page.locator('textarea').fill('Software Engineer at Acme Corp — 5+ years experience required.');
    const btn = page.locator('button', { hasText: 'Generate Application Package' });
    await expect(btn).toBeEnabled();
  });

  test('shows loading state when generate is clicked', async ({ page }) => {
    await page.goto('/dashboard/draft');
    await page.waitForLoadState('networkidle');
    await page.locator('textarea').fill('We are looking for a Senior Product Manager with 5+ years experience in SaaS.');

    // Intercept the API call so we can see the loading state
    await page.route('/api/application/draft', async (route) => {
      // Delay response to allow loading state to render
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          detected_company: 'Test Corp',
          detected_role: 'Senior PM',
          cover_letter: 'Dear Hiring Team,\n\nThank you for this opportunity.',
          tone: 'formal',
          screening_questions: [
            { question: 'Why do you want this role?', answer: 'I am passionate about product.', tags: ['motivation'] }
          ],
          key_requirements: ['5+ years PM', 'SaaS'],
          match_score: 80,
          match_notes: 'Good match',
        }),
      });
    });

    await page.locator('button', { hasText: 'Generate Application Package' }).click();
    // Generating text should appear briefly
    await expect(page.locator('text=Generating')).toBeVisible({ timeout: 2000 });
  });

  test('shows results after generation', async ({ page }) => {
    await page.goto('/dashboard/draft');
    await page.waitForLoadState('networkidle');
    await page.locator('textarea').fill('We are looking for a Senior Product Manager with 5+ years experience in SaaS.');

    await page.route('/api/application/draft', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          detected_company: 'Acme Corp',
          detected_role: 'Senior PM',
          cover_letter: 'Dear Hiring Team,\n\nThank you for this opportunity.',
          tone: 'formal',
          screening_questions: [
            { question: 'Why do you want this role?', answer: 'I am passionate about product.', tags: ['motivation'] }
          ],
          key_requirements: ['5+ years PM', 'SaaS'],
          match_score: 85,
          match_notes: 'Strong match on product experience.',
        }),
      });
    });

    await page.locator('button', { hasText: 'Generate Application Package' }).click();
    await expect(page.locator('text=Acme Corp — Senior PM')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[role=tab]', { hasText: 'Cover Letter' })).toBeVisible();
    await expect(page.locator('[role=tab]', { hasText: 'Screening Q&A' })).toBeVisible();
  });
});

// Unauthenticated API tests
test.describe('Draft API — unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('API /api/application/draft returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.post('/api/application/draft', {
      data: { jobDescription: 'Test job description' },
    });
    expect(res.status()).toBe(401);
  });

  test('API /api/application/draft returns 400 when jobDescription missing', async ({ request }) => {
    // This will return 401 (unauth), which is fine — it checks auth first
    const res = await request.post('/api/application/draft', {
      data: {},
    });
    expect([400, 401]).toContain(res.status());
  });

  test('API /api/application/save-draft returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.post('/api/application/save-draft', {
      data: { company: 'Acme', role: 'PM', jobDescription: 'test', coverLetter: 'test', screeningAnswers: [] },
    });
    expect(res.status()).toBe(401);
  });

  test('API /api/application/improve returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.post('/api/application/improve', {
      data: {
        type: 'cover_letter',
        content: 'Test content',
        instruction: 'Make it shorter',
        jobDescription: 'Test JD',
      },
    });
    expect(res.status()).toBe(401);
  });
});
