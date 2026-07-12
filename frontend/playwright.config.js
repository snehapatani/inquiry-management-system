import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure', // Create videos for failed and passed tests
  },
  webServer: undefined, // Dev server is already running
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        recordVideo: 'retain-on-failure', // Explicit video setting
      },
    },
  ],
  timeout: 60 * 1000,
});
