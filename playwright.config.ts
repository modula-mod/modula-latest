import {defineConfig, devices} from '@playwright/test'

const baseURL = process.env.MODULA_BROWSER_BASE_URL ?? 'http://127.0.0.1:4174'
const localBrowserOrigin = (() => {
  try {
    const url = new URL(baseURL)
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  } catch {
    return false
  }
})()
const localURL = new URL(baseURL)

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  reporter: 'line',
  use: {
    ...devices['Desktop Chrome'],
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
    },
  },
  webServer: localBrowserOrigin
    ? {
        command: 'pnpm build:web && node scripts/serve-web-dist.mjs',
        env: {
          HOST: localURL.hostname,
          PORT: localURL.port || '4174',
        },
        reuseExistingServer: false,
        timeout: 120_000,
        url: baseURL,
      }
    : undefined,
})
