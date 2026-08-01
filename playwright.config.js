import { defineConfig, devices } from '@playwright/test';

const siteBasePath = process.env.E2E_BASE_PATH || '/';
const appPath = process.env.E2E_APP_PATH || 'birthday/';
const e2ePort = Number(process.env.E2E_PORT || 4183);
const siteURL = new URL(siteBasePath, `http://127.0.0.1:${e2ePort}/`).href;
const baseURL = new URL(appPath, siteURL).href;

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
        permissions: ['camera'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
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
    url: siteURL,
    reuseExistingServer: !process.env.CI,
  },
});
