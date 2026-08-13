import {expect, test, type Page} from '@playwright/test'

const baseURL = process.env.MODULA_BROWSER_BASE_URL ?? 'http://127.0.0.1:4174'
const localBrowserOrigin = (() => {
  try {
    const host = new URL(baseURL).hostname
    return host === '127.0.0.1' || host === 'localhost'
  } catch {
    return false
  }
})()

const publicRoutes = [
  '/sign-in',
  '/register',
  '/forgot-password',
  '/verify-email',
  '/',
  '/discover',
  '/settings',
  '/settings/appearance',
  '/settings/security',
] as const

const envelope = (data: unknown) => ({
  ok: true,
  data,
  meta: {
    requestId: 'phase7l-b-browser-fixture',
    serverTime: '2026-08-13T00:00:00.000Z',
  },
})

const routeFixtures: Record<string, unknown> = {
  '/v1/meta': {
    apiVersion: 'v1',
    protocolVersion: 'phase7l-b',
    environment: 'production',
    minimumClientVersion: '0.1.0',
    registration: {
      mode: 'invite-only',
      emailVerificationRequired: true,
    },
    capabilities: {
      publicRead: true,
      authentication: true,
      mutations: true,
      mediaUpload: true,
      atproto: false,
      modules: true,
      atprotoOAuth: false,
      atprotoPublishing: false,
      atprotoImport: false,
      pdsPilot: false,
    },
  },
  '/v1/discover': {
    suggestedProfiles: [],
    trendingTopics: [],
    featuredModules: [],
    media: [],
    reels: [],
  },
  '/v1/feed/home': {
    items: [],
    nextCursor: null,
    hasMore: false,
  },
}

async function installLocalApiFixtures(page: Page) {
  await page.route(/^https:\/\/api\.modula\.digital\/v1\/(meta|discover|feed\/home)(\?.*)?$/, async route => {
    const request = route.request()
    const url = new URL(request.url())
    const fixture = routeFixtures[url.pathname]
    const headers = {
      'Access-Control-Allow-Headers': 'content-type,x-modula-request-id,authorization',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    }

    if (request.method() === 'OPTIONS') {
      await route.fulfill({status: 204, headers})
      return
    }

    await route.fulfill({
      status: fixture ? 200 : 404,
      headers,
      body: JSON.stringify(fixture ? envelope(fixture) : envelope(null)),
    })
  })
}

test.describe('Phase 7L-B public route rendering', () => {
  for (const route of publicRoutes) {
    test(`${route} has no critical hydration/runtime errors`, async ({page}) => {
      const events: Array<{type: string; text: string}> = []

      if (localBrowserOrigin) {
        await installLocalApiFixtures(page)
      }

      page.on('pageerror', error => {
        events.push({type: 'pageerror', text: error.message})
      })
      page.on('console', message => {
        if (message.type() === 'error' || message.type() === 'warning') {
          events.push({type: `console.${message.type()}`, text: message.text()})
        }
      })
      page.on('requestfailed', request => {
        events.push({
          type: 'requestfailed',
          text: `${request.failure()?.errorText ?? 'unknown'} ${request.url()}`,
        })
      })

      const response = await page.goto(new URL(route, baseURL).toString(), {
        waitUntil: 'networkidle',
      })
      await page.waitForTimeout(500)

      expect(response?.status(), `${route} HTTP status`).toBeLessThan(400)

      const criticalEvents = events.filter(event => {
        if (/Minified React error #418|hydration/i.test(event.text)) return true
        if (event.type === 'pageerror') return true
        if (event.type === 'requestfailed') return true
        if (event.type === 'console.error') return true
        return false
      })

      expect(criticalEvents, JSON.stringify(criticalEvents, null, 2)).toEqual([])
    })
  }
})
