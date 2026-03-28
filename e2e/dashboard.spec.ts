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

test.describe('Dashboard — Authenticated', () => {
  test('dashboard page loads without console errors', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[title="Chat"]').first()).toBeVisible();
    const critical = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('Failed to load resource')
    );
    expect(critical).toEqual([]);
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/dashboard');

    const navLinks = [
      { text: 'Applications', url: '/dashboard/applications' },
      { text: 'Resumes', url: '/dashboard/resumes' },
      { text: 'Profile', url: '/dashboard/profile' },
      { text: 'Emails', url: '/dashboard/emails' },
      { text: 'Settings', url: '/dashboard/settings' },
    ];

    for (const link of navLinks) {
      // Use title attribute to target actual link/button elements (not tooltip spans)
      const navItem = page.locator(`a[title="${link.text}"], button[title="${link.text}"]`).first();
      if (await navItem.isVisible()) {
        await navItem.click();
        await page.waitForURL(`**${link.url}**`, { timeout: 10_000 });
        expect(page.url()).toContain(link.url);
      }
    }
  });
});

test.describe('All Dashboard Pages — Error Check', () => {
  const pages = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Applications', path: '/dashboard/applications' },
    { name: 'Resumes', path: '/dashboard/resumes' },
    { name: 'Profile', path: '/dashboard/profile' },
    { name: 'Emails', path: '/dashboard/emails' },
    { name: 'Settings', path: '/dashboard/settings' },
  ];

  for (const p of pages) {
    test(`${p.name} page loads without crashes`, async ({ page }) => {
      const errors = trackConsoleErrors(page);

      await page.goto(p.path);
      await page.waitForLoadState('networkidle');

      // Page should not show error boundary or crash
      const body = await page.textContent('body');
      expect(body).not.toContain('Application error');
      expect(body).not.toMatch(/Internal Server Error|500 Internal/i);

      // No critical console errors (filter out known non-issues)
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
  }
});
