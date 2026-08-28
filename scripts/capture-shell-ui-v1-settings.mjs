#!/usr/bin/env node
/**
 * Capture Settings / Accessibility screenshots for PR evidence.
 * Usage: MODULA_BROWSER_BASE_URL=http://127.0.0.1:8090 node scripts/capture-shell-ui-v1-settings.mjs
 */
import {mkdirSync} from 'node:fs'
import path from 'node:path'
import {chromium, devices} from '@playwright/test'

const baseURL = process.env.MODULA_BROWSER_BASE_URL ?? 'http://127.0.0.1:8090'
const outDir = path.resolve('docs/validation/evidence/shell-ui-v1')
mkdirSync(outDir, {recursive: true})

const chrome =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const routes = [
  {path: '/settings', name: 'web-settings'},
  {path: '/settings/accessibility', name: 'web-accessibility'},
  {path: '/settings/display-and-text', name: 'web-display-and-text'},
  {path: '/settings/display-and-text/larger-text', name: 'web-larger-text'},
  {path: '/settings/accessibility/hover-text', name: 'web-hover-text'},
  {path: '/settings/motion', name: 'web-motion'},
]

async function capture(colorScheme) {
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
  })
  const context = await browser.newContext({
    ...devices['iPhone 14 Pro'],
    colorScheme,
    baseURL,
  })
  const page = await context.newPage()
  const suffix = colorScheme === 'dark' ? 'dark' : 'light'

  for (const route of routes) {
    await page.goto(route.path, {waitUntil: 'networkidle', timeout: 60_000})
    await page.waitForTimeout(600)
    const file = path.join(outDir, `${route.name}-${suffix}.png`)
    await page.screenshot({path: file, fullPage: false})
    console.log('wrote', file)
    if (route.name === 'web-settings' || route.name === 'web-accessibility') {
      await page.evaluate(() => window.scrollTo(0, 520))
      await page.waitForTimeout(200)
      const scrolled = path.join(outDir, `${route.name}-${suffix}-scrolled.png`)
      await page.screenshot({path: scrolled, fullPage: false})
      console.log('wrote', scrolled)
    }
  }

  await browser.close()
}

await capture('dark')
await capture('light')
console.log('capture complete')
