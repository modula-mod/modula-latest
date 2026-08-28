import {expect, test, type Page} from '@playwright/test'

const baseURL = process.env.MODULA_BROWSER_BASE_URL ?? 'http://127.0.0.1:4174'
const browserOrigin = new URL(baseURL).origin
const localBrowserOrigin = ['127.0.0.1', 'localhost', '0.0.0.0'].includes(new URL(baseURL).hostname)
const localDemoApi = process.env.MODULA_BROWSER_LOCAL_DEMO === '1'
const expectedComment = localDemoApi
  ? 'One interaction grammar makes every post easier to learn.'
  : 'Top-level Phase 6S comment fixture.'

const routes = [
  '/welcome',
  '/sign-in',
  '/verify-email?email=founder%40example.test',
  '/',
  '/index',
  '/discover',
  '/discover/feeds',
  '/discover/inspire',
  '/discover/interests',
  '/messages',
  '/saved',
  '/share-profile',
  '/share',
  '/profile/andrei.modula',
  '/post/post-local-owner-media',
  '/post/post-local-owner-media/analytics',
  '/marketplace',
  '/marketplace/digital.modula.vault-notes',
  '/marketplace/seller/seller-modula',
  '/module/digital.modula.vault-notes',
  '/settings',
  '/settings/extensions',
  '/settings/extensions/modula.core.composerTools',
  '/product/intelligence/gaia',
  '/phase7m-b7-intentional-not-found',
] as const

function collectCriticalEvents(page: Page) {
  const events: string[] = []
  page.on('pageerror', error => events.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') events.push(`console.error: ${message.text()}`)
  })
  page.on('requestfailed', request => {
    events.push(`requestfailed: ${request.failure()?.errorText ?? 'unknown'} ${request.url()}`)
  })
  return events
}

test.beforeEach(async ({page}) => {
  if (!localBrowserOrigin || localDemoApi) return

  // The production API deliberately accepts only the production web origin.
  // Pre-cutover artifact tests proxy its read-only responses through Playwright;
  // the real CORS contract is verified again after the public symlink cutover.
  await page.route('https://api.modula.digital/**', async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': browserOrigin,
          'access-control-allow-methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
          'access-control-allow-headers': 'Accept, Authorization, Content-Type, X-Modula-Request-Id',
        },
      })
      return
    }

    const requestHeaders = {...route.request().headers()}
    delete requestHeaders.origin
    delete requestHeaders.referer
    const response = await route.fetch({headers: requestHeaders})
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'access-control-allow-origin': browserOrigin,
        'cross-origin-resource-policy': 'cross-origin',
      },
    })
  })
})

test.describe('Phase 7M-B7 exact web route gate', () => {
  for (const route of routes) {
    test(`${route} direct load is hydrated`, async ({page}) => {
      const events = collectCriticalEvents(page)
      const response = await page.goto(new URL(route, baseURL).toString(), {waitUntil: 'networkidle'})
      await page.waitForTimeout(600)

      expect(response?.status(), `${route} HTTP status`).toBeLessThan(400)
      if (route === '/marketplace') {
        await expect(page.getByText('Loading catalogue.', {exact: true})).toBeHidden()
        await expect(page.getByRole('heading', {name: 'Product Hub', level: 1})).toBeVisible()
        await expect(page.getByRole('link', {name: 'Open featured Vault Notes'})).toBeVisible()
      }
      if (route === '/module/digital.modula.vault-notes') {
        await expect(page.getByText('Loading module', {exact: true})).toBeHidden()
        await expect(page.getByText('Vault Notes', {exact: true}).first()).toBeVisible()
      }
      expect(events, JSON.stringify(events, null, 2)).toEqual([])
    })
  }
})

test('Post V2 public interactions share one overlay grammar', async ({page}) => {
  const events = collectCriticalEvents(page)
  await page.goto(new URL('/post/post-local-owner-media', baseURL).toString(), {waitUntil: 'networkidle'})

  const shellBox = await page.getByTestId('post-shell').boundingBox()
  expect(shellBox?.height ?? 0).toBeGreaterThan(600)

  const reactionTrigger = page.getByRole('button', {name: 'Choose reaction'})
  await reactionTrigger.click()
  await expect(page.getByRole('button', {name: 'Love'})).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', {name: 'Love'})).toBeHidden()
  await expect(reactionTrigger).toBeFocused()

  const menuTrigger = page.getByRole('button', {name: 'Open post menu'})
  await menuTrigger.click()
  await expect(page.getByRole('menuitem', {name: 'Copy link'})).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menuitem', {name: 'Copy link'})).toBeHidden()
  await expect(menuTrigger).toBeFocused()

  await page.getByRole('button', {name: 'Comment'}).click()
  await expect(page.getByText('Comments', {exact: true})).toBeVisible()
  await expect(page.getByText(expectedComment, {exact: true})).toBeVisible()
  await expect(page.getByRole('textbox', {name: 'Write a comment'})).toBeVisible()
  await page.getByRole('button', {name: 'Close comments'}).click()
  await expect(page.getByText('Comments', {exact: true})).toBeHidden()

  await expect(page.getByText('1/2', {exact: true})).toBeVisible()
  const carousel = page.getByTestId('post-carousel')
  await carousel.evaluate(element => {
    element.scrollLeft = element.clientWidth
    element.dispatchEvent(new Event('scroll', {bubbles: true}))
  })
  await expect(page.getByText('2/2', {exact: true})).toBeVisible()

  expect(events, JSON.stringify(events, null, 2)).toEqual([])
})

test('Post V2 comment composer persists through the local API', async ({page}) => {
  test.skip(!localDemoApi, 'The controlled demo account exists only in the isolated local API.')
  const events = collectCriticalEvents(page)
  await page.goto(new URL('/post/post-local-owner-media', baseURL).toString(), {waitUntil: 'networkidle'})

  await page.getByRole('button', {name: 'Unlike'}).click()
  await page.getByRole('button', {name: 'Sign in', exact: true}).click()
  await page.getByRole('link', {name: 'Development demo'}).click()
  await expect(page).toHaveURL(/\/post\/post-local-owner-media$/)

  await page.getByRole('button', {name: 'Comment'}).click()
  const composer = page.getByRole('textbox', {name: 'Write a comment'})
  await composer.fill('Post V2 browser acceptance comment.')
  await page.getByRole('button', {name: 'Send comment'}).click()
  await expect(page.getByText('Post V2 browser acceptance comment.', {exact: true})).toBeVisible()

  expect(events, JSON.stringify(events, null, 2)).toEqual([])
})
