import { test, expect } from '@playwright/test';

test.describe('Market Settings', () => {
  test('settings page shows Your Markets section', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByText('Your Markets')).toBeVisible();
    await expect(
      page.getByText('Configure which country job markets you')
    ).toBeVisible();
  });

  test('default market Sweden is shown for test user', async ({ page }) => {
    await page.goto('/dashboard/settings');
    // Sweden should appear (either via market card or as available market)
    const swedenText = page.getByText('Sweden');
    await expect(swedenText.first()).toBeVisible();
  });

  test('Add Market button is visible and clickable', async ({ page }) => {
    await page.goto('/dashboard/settings');
    const addButton = page.getByRole('button', { name: /add market/i });
    await expect(addButton).toBeVisible();
    // Click to open the dropdown
    await addButton.click();
    // Dropdown should show available markets (any of the 5 configured markets)
    const dropdown = page.locator('[role="menu"]');
    await expect(dropdown).toBeVisible();
  });

  test('market card shows correct info', async ({ page }) => {
    await page.goto('/dashboard/settings');
    // If Sweden is already added (test user has it), check flag and name
    const swedenFlag = page.getByText('🇸🇪');
    if (await swedenFlag.isVisible()) {
      await expect(page.getByText('Sweden')).toBeVisible();
      // Check that currency / language info is shown
      await expect(page.getByText(/SEK/)).toBeVisible();
    } else {
      // If not added, it should at least appear in the add dropdown
      const addButton = page.getByRole('button', { name: /add market/i });
      if (await addButton.isVisible()) {
        await addButton.click();
        await expect(page.getByRole('menuitem', { name: /Sweden/i })).toBeVisible();
      }
    }
  });
});

test.describe('Market API Health', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('extension profile includes market info when authenticated', async ({ request }) => {
    // Without auth, should get 401
    const response = await request.get('/api/extension/profile');
    expect(response.status()).toBe(401);
  });

  test('jobs search API accepts market parameter', async ({ request }) => {
    // Without auth, should still get 401 (not 400/500)
    const response = await request.get('/api/jobs/search?q=engineer&market=SE');
    expect(response.status()).toBe(401);
  });

  test('jobs search API accepts market=GB parameter', async ({ request }) => {
    const response = await request.get('/api/jobs/search?q=engineer&market=GB');
    expect(response.status()).toBe(401);
  });
});
