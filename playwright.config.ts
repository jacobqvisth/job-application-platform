import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Find .env.local by walking up from __dirname (handles git worktrees)
function findEnvFile(startDir: string): string | undefined {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.env.local');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

const envFile = findEnvFile(__dirname);
if (envFile) {
  dotenv.config({ path: envFile });
} else {
  console.warn('Warning: .env.local not found — set env vars manually');
}

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Find the repo root (where package.json with "dev" script lives)
function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'next.config.ts'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

const repoRoot = findRepoRoot(__dirname);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Auth setup — runs first, saves session state
    { name: 'setup', testMatch: /.*\.setup\.ts/, teardown: 'cleanup' },
    { name: 'cleanup', testMatch: /.*\.teardown\.ts/ },
    {
      name: 'chromium',
      testIgnore: /.*smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Smoke tests that don't need auth
    {
      name: 'smoke',
      testMatch: /.*smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start local dev server if testing locally
  webServer: baseURL.includes('localhost') ? {
    command: 'npm run dev',
    cwd: repoRoot,
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  } : undefined,
});
