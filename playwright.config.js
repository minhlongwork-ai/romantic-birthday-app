import { defineConfig, devices } from '@playwright/test';

const basePath = process.env.E2E_BASE_PATH || '/';
const e2ePort = Number(process.env.E2E_PORT || 4183);
const baseURL = new URL(basePath, `http://127.0.0.1:${e2ePort}/`).href;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'android-chrome',
      use: {
        ...devices['Pixel 7'],
      },
    },
    {
      name: 'desktop-firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
    {
      name: 'desktop-safari',
      use: {
        ...devices['Desktop Safari'],
      },
    },
    {
      name: 'ios-safari',
      use: {
        ...devices['iPhone 13'],
      },
    },
  ],
  webServer: {
    command: 'npm run preview:e2e',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
