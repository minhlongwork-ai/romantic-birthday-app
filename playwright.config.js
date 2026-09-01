import { defineConfig, devices } from '@playwright/test';

const siteBasePath = process.env.E2E_BASE_PATH || '/';
const appPath = process.env.E2E_APP_PATH || 'birthday/';
const e2ePort = Number(process.env.E2E_PORT || 4183);
const e2eHttpsPort = Number(process.env.E2E_HTTPS_PORT || 4184);
const remoteURL = process.env.E2E_REMOTE_URL?.trim();
const siteURL = remoteURL
  ? new URL(siteBasePath, new URL(remoteURL.endsWith('/') ? remoteURL : `${remoteURL}/`)).href
  : new URL(siteBasePath, `http://127.0.0.1:${e2ePort}/`).href;
const baseURL = new URL(appPath, siteURL).href;
const httpsSiteURL = new URL(siteBasePath, `https://127.0.0.1:${e2eHttpsPort}/`).href;
const httpsBaseURL = new URL('september/', httpsSiteURL).href;
const iphoneX = Object.fromEntries(
  Object.entries(devices['iPhone X']).filter(([key]) => key !== 'defaultBrowserType'),
);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
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
      testIgnore: /iphone-x-layout\.spec\.js/,
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
      name: 'desktop-chrome-https',
      testMatch: /performance\.spec\.js/,
      testIgnore: remoteURL ? /performance\.spec\.js/ : undefined,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: httpsBaseURL,
        ignoreHTTPSErrors: true,
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
      testIgnore: /iphone-x-layout\.spec\.js/,
      use: {
        ...devices['Pixel 7'],
      },
    },
    {
      name: 'desktop-firefox',
      testIgnore: /iphone-x-layout\.spec\.js/,
      use: {
        ...devices['Desktop Firefox'],
      },
    },
    {
      name: 'desktop-safari',
      testIgnore: /iphone-x-layout\.spec\.js/,
      use: {
        ...devices['Desktop Safari'],
      },
    },
    {
      name: 'ios-safari',
      testIgnore: /iphone-x-layout\.spec\.js/,
      use: {
        ...devices['iPhone 13'],
      },
    },
    {
      name: 'iphone-x',
      testMatch: /iphone-x-layout\.spec\.js/,
      use: {
        ...iphoneX,
      },
    },
  ],
  webServer: remoteURL
    ? undefined
    : [
        {
          command: 'npm run preview:e2e',
          url: siteURL,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: 'node scripts/serve-dist-https.mjs',
          url: httpsSiteURL,
          ignoreHTTPSErrors: true,
          reuseExistingServer: !process.env.CI,
        },
      ],
});
