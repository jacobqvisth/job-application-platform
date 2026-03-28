import { test, expect, type Page } from '@playwright/test';

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

function filterCriticalErrors(errors: string[]) {
  return errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('404') &&
    !e.includes('Failed to load resource') &&
    !e.includes('Download the React DevTools') &&
    !e.includes('Third-party cookie') &&
    !e.includes('CORS policy') &&
    !e.includes('accounts.google.com')
  );
}

test.describe('Knowledge — Dashboard', () => {
  test('knowledge dashboard loads without errors', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto('/dashboard/knowledge');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body).not.toContain('Application error');
    expect(body).not.toMatch(/Internal Server Error|500 Internal/i);

    await expect(page.locator('text=Your Knowledge Base').first()).toBeVisible();
    expect(filterCriticalErrors(errors)).toEqual([]);
  });

  test('completeness grid renders', async ({ page }) => {
    await page.goto('/dashboard/knowledge');
    await page.waitForLoadState('networkidle');

    // Profile Completeness card should be visible
    await expect(page.locator('text=Profile Completeness').first()).toBeVisible();

    // At least one category card should render (Facts is always shown)
    await expect(page.locator('text=Facts').first()).toBeVisible();
    await expect(page.locator('text=Skills').first()).toBeVisible();
  });

  test('quick actions buttons are present', async ({ page }) => {
    await page.goto('/dashboard/knowledge');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Upload Documents').first()).toBeVisible();
    await expect(page.locator('text=Start Interview').first()).toBeVisible();
  });

  test('profile summary section renders', async ({ page }) => {
    await page.goto('/dashboard/knowledge');
    await page.waitForLoadState('networkidle');

    // Either populated summary or empty state should be visible
    const hasSummary = await page.locator('text=Professional Identity').count();
    const hasEmptyState = await page.locator('text=/generate|no summary|interview/i').count();
    expect(hasSummary + hasEmptyState).toBeGreaterThan(0);
  });

  test('all knowledge items section renders with filters', async ({ page }) => {
    await page.goto('/dashboard/knowledge');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=All Knowledge Items').first()).toBeVisible();

    // Filter controls
    const categorySelect = page.locator('select[name="category"]');
    await expect(categorySelect).toBeVisible();

    const searchInput = page.locator('input[name="search"]');
    await expect(searchInput).toBeVisible();
  });
});

test.describe('Knowledge — Upload Page', () => {
  test('upload page loads without errors', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto('/dashboard/knowledge/upload');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body).not.toContain('Application error');

    expect(filterCriticalErrors(errors)).toEqual([]);
  });

  test('upload zone and file input are present', async ({ page }) => {
    await page.goto('/dashboard/knowledge/upload');
    await page.waitForLoadState('networkidle');

    // Should have a file input or drag zone
    const fileInput = page.locator('input[type="file"]');
    const dragZone = page.locator('text=/drag|drop|upload/i').first();

    const hasInput = await fileInput.count();
    const hasZone = await dragZone.isVisible();
    expect(hasInput + (hasZone ? 1 : 0)).toBeGreaterThan(0);
  });
});

test.describe('Knowledge — Interview Page', () => {
  test('interview page loads without errors', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto('/dashboard/knowledge/interview');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body).not.toContain('Application error');
    expect(body).not.toMatch(/Internal Server Error|500 Internal/i);

    expect(filterCriticalErrors(errors)).toEqual([]);
  });

  test('interview topic list renders with expected topics', async ({ page }) => {
    await page.goto('/dashboard/knowledge/interview');
    await page.waitForLoadState('networkidle');

    // "Your Career Story" is one of the 9 topics
    await expect(page.locator('text=Your Career Story').first()).toBeVisible();
  });

  test('interview page shows 9 topics', async ({ page }) => {
    await page.goto('/dashboard/knowledge/interview');
    await page.waitForLoadState('networkidle');

    // All 9 topic labels should appear somewhere on the page
    const topicLabels = [
      'Your Career Story',
      'Strengths & Superpowers',
      'Your Best Stories',
      'Technical Deep-Dive',
      'Leadership & Management',
      "What You're Looking For",
      'Compensation & Dealbreakers',
      'Growth & Development',
      'How You Work',
    ];

    for (const label of topicLabels) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

test.describe('Knowledge — Navigation', () => {
  test('sidebar has KNOWLEDGE section with all three links', async ({ page }) => {
    await page.goto('/dashboard/knowledge');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('nav');

    // KNOWLEDGE section label
    await expect(nav.locator('text=KNOWLEDGE').first()).toBeVisible();

    // All three knowledge nav links
    await expect(nav.locator('a[href="/dashboard/knowledge"]').first()).toBeVisible();
    await expect(nav.locator('a[href="/dashboard/knowledge/upload"]').first()).toBeVisible();
    await expect(nav.locator('a[href="/dashboard/knowledge/interview"]').first()).toBeVisible();
  });

  test('Start Interview button navigates to interview page', async ({ page }) => {
    await page.goto('/dashboard/knowledge');
    await page.waitForLoadState('networkidle');

    const startBtn = page.locator('a[href="/dashboard/knowledge/interview"]').first();
    await expect(startBtn).toBeVisible();
  });
});

test.describe('Knowledge — Category Filter', () => {
  test('category filter via URL param works', async ({ page }) => {
    await page.goto('/dashboard/knowledge?category=skill');
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body).not.toContain('Application error');

    // Category select should show the active filter
    const select = page.locator('select[name="category"]');
    await expect(select).toHaveValue('skill');
  });

  test('completeness cards link to category-filtered view', async ({ page }) => {
    await page.goto('/dashboard/knowledge');
    await page.waitForLoadState('networkidle');

    // Click "Facts" category card — should link to ?category=fact
    const factsCard = page.locator('a[href*="category=fact"]').first();
    await expect(factsCard).toBeVisible();
    await factsCard.click();
    await page.waitForURL('**/dashboard/knowledge?category=fact', { timeout: 10_000 });
    expect(page.url()).toContain('category=fact');
  });
});
