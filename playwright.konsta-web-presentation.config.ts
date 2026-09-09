import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: 'konsta-web-presentation.test.ts',
  timeout: 60_000,
  reporter: 'line',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.MODULA_BROWSER_BASE_URL ?? 'http://127.0.0.1:8088',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
    },
    trace: 'retain-on-failure',
  },
})
