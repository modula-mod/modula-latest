import {defineConfig, devices} from '@playwright/test'

const apiBaseURL = process.env.MODULA_PUBLIC_API_URL ?? 'http://127.0.0.1:4022'
const webBaseURL = process.env.MODULA_BROWSER_BASE_URL ?? 'http://127.0.0.1:4174'
const apiURL = new URL(apiBaseURL)
const webURL = new URL(webBaseURL)
const webPort = webURL.port || (webURL.protocol === 'https:' ? '443' : '80')
const allowedOrigins = Array.from(
  new Set([
    webURL.origin,
    `http://127.0.0.1:${webPort}`,
    `http://localhost:${webPort}`,
  ]),
).join(',')

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) {
  throw new Error('MODULA_TEST_DATABASE_URL or MODULA_DATABASE_URL is required for Phase 7L-B auth browser verification.')
}

const apiEnv = {
  CI: process.env.CI ?? 'true',
  NODE_ENV: process.env.NODE_ENV ?? 'test',
  MODULA_ENVIRONMENT: process.env.MODULA_ENVIRONMENT ?? 'development',
  MODULA_API_HOST: apiURL.hostname,
  MODULA_API_PORT: apiURL.port || '4022',
  MODULA_PUBLIC_API_URL: apiURL.origin,
  MODULA_PUBLIC_WEB_URL: webURL.origin,
  MODULA_DATABASE_URL: databaseUrl,
  MODULA_DATABASE_MIGRATOR_URL: process.env.MODULA_DATABASE_MIGRATOR_URL ?? databaseUrl,
  MODULA_ALLOWED_ORIGINS: process.env.MODULA_ALLOWED_ORIGINS ?? allowedOrigins,
  MODULA_PREVIEW_WRITES_ENABLED: process.env.MODULA_PREVIEW_WRITES_ENABLED ?? 'true',
  MODULA_REGISTRATION_MODE: process.env.MODULA_REGISTRATION_MODE ?? 'open',
  MODULA_INVITE_ONLY: process.env.MODULA_INVITE_ONLY ?? 'false',
  MODULA_RATE_LIMIT_ENABLED: process.env.MODULA_RATE_LIMIT_ENABLED ?? 'false',
  MODULA_ATPROTO_ENABLED: process.env.MODULA_ATPROTO_ENABLED ?? 'false',
  MODULA_LOG_LEVEL: process.env.MODULA_LOG_LEVEL ?? 'silent',
}

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  reporter: 'line',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: webURL.origin,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
    },
  },
  webServer: [
    {
      command: 'pnpm --filter @modula/greenfield-api exec tsx src/main.ts',
      env: apiEnv,
      reuseExistingServer: false,
      timeout: 120_000,
      url: `${apiURL.origin}/v1/health/live`,
    },
    {
      command: 'node scripts/serve-web-dist.mjs',
      env: {
        HOST: webURL.hostname,
        PORT: webPort,
      },
      reuseExistingServer: false,
      timeout: 30_000,
      url: webURL.origin,
    },
  ],
})
