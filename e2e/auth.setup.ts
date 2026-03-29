import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const STORAGE_STATE = 'e2e/.auth/user.json';
const TEST_PASSWORD = 'test-password-e2e-2026!';

setup('authenticate', async ({ page }) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const testEmail = process.env.TEST_USER_EMAIL || 'e2e-test@test.local';

  // Get or create test user (password-based, not Google OAuth)
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const testUser = existingUsers?.users?.find(u => u.email === testEmail);

  if (!testUser) {
    const { error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Test User' },
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
  }

  // Navigate to app first (establishes cookie domain)
  await page.goto('/');

  // Sign in via the test-only endpoint — it sets SSR auth cookies on the response
  const response = await page.request.post('/api/e2e-login', {
    data: { email: testEmail, password: TEST_PASSWORD, secret: process.env.E2E_SECRET || process.env.CRON_SECRET },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Login failed (${response.status()}): ${body}`);
  }

  // Navigate to dashboard — auth cookies are now set
  await page.goto('/dashboard');
  await page.waitForURL('**/dashboard**', { timeout: 15_000 });
  await expect(page.locator('[title="Chat"]').first()).toBeVisible({ timeout: 10_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});
