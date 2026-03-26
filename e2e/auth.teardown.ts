import { test as teardown } from '@playwright/test';

teardown('cleanup auth state', async () => {
  // Nothing to clean up for now — the test user stays in Supabase
  // If you want to delete the test user, do it here
});
