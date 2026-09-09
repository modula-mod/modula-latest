import AxeBuilder from '@axe-core/playwright'
import {expect, test, type Page} from '@playwright/test'

const ROUTE = '/settings/developer/modula-ui-lab'
const EVIDENCE = 'docs/validation/web-ui-adapter-v1'
const BASE_URL = process.env.MODULA_BROWSER_BASE_URL ?? 'http://127.0.0.1:4174'
const BROWSER_ORIGIN = new URL(BASE_URL).origin

test.beforeEach(async ({page}) => {
  await page.route('https://api.modula.digital/**', async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': BROWSER_ORIGIN,
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
        'access-control-allow-origin': BROWSER_ORIGIN,
        'cross-origin-resource-policy': 'cross-origin',
      },
    })
  })
})

async function openLab(page: Page, width: number, height: number) {
  const errors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({width, height})
  await page.goto(ROUTE, {waitUntil: 'networkidle'})
  await expect(page.getByTestId('web-ui-adapter-lab')).toBeVisible()
  await expect(page.locator('body')).not.toHaveText('Developer settings are unavailable.')
  return errors
}

async function expectNoAxeViolations(page: Page, selector: string) {
  const axe = await new AxeBuilder({page}).include(selector).analyze()
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([])
}

async function expectSingleDrawerSurface(page: Page) {
  await expect(page.locator('.modula-web-drawer-popup:visible')).toHaveCount(1)
  await expect(page.locator('.modula-web-drawer-backdrop:visible')).toHaveCount(1)
  await expect(page.locator('.modula-web-drawer-handle-target:visible')).toHaveCount(1)
  await expect(page.locator('.modula-web-overlay-body[data-scroll="true"]:visible')).toHaveCount(1)
}

test('desktop interaction, keyboard, focus return, axe, and 1440 evidence', async ({page}) => {
  const errors = await openLab(page, 1440, 1000)
  const contentTrigger = page.getByTestId('web-adapter-drawer-content')
  await contentTrigger.click()
  const dialog = page.getByRole('dialog').last()
  await expect(dialog).toContainText('Content')
  await expect(dialog.getByText('Content-sized by default')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(contentTrigger).toBeFocused()

  await page.getByRole('button', {name: 'Open adapter menu'}).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('End')
  await page.keyboard.press('Home')
  await page.getByRole('menuitem', {name: 'Copy link'}).click()
  await expect(page.getByText('copy action selected', {exact: true})).toBeVisible()
  await expect(page.getByRole('button', {name: 'Open adapter menu'})).toBeFocused()

  await page.getByRole('button', {name: 'Open adapter menu'}).click()
  await page.getByRole('menuitem', {name: 'Delete'}).click()
  const confirmation = page.getByTestId('modula-confirmation-dialog')
  await expect(confirmation).toBeVisible()
  await expect(confirmation).toContainText('Delete example?')
  await confirmation.getByRole('button', {name: 'Delete'}).click()
  await expect(page.getByText('Delete action confirmed', {exact: true})).toBeVisible()

  const sharedActionTrigger = page.getByRole('button', {name: 'Shared action presenter'})
  await sharedActionTrigger.click()
  const sharedActionDialog = page.getByRole('dialog').last()
  await expect(sharedActionDialog).toContainText('Shared actions')
  await sharedActionDialog.getByRole('button', {name: 'Copy example'}).click()
  await expect(page.getByText('shared-copy selected', {exact: true})).toBeVisible()
  await expect(sharedActionTrigger).toBeFocused()

  const backBox = await page.getByRole('button', {name: 'Preview back control'}).boundingBox()
  const moreBox = await page.getByRole('button', {name: 'Preview more options'}).boundingBox()
  expect(backBox?.width).toBe(moreBox?.width)
  expect(backBox?.height).toBe(moreBox?.height)
  const chromeBlur = await page.getByRole('button', {name: 'Preview back control'}).evaluate(element => {
    let node: Element | null = element
    while (node) {
      const style = getComputedStyle(node)
      const filter = style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter')
      if (filter && filter !== 'none') return filter
      node = node.parentElement
    }
    return 'none'
  })
  expect(chromeBlur).toContain('blur')

  await page.getByTestId('web-adapter-context-target').click({button: 'right'})
  await expect(page.getByRole('menu')).toContainText('Context actions')
  await page.keyboard.press('Escape')

  await page.getByRole('button', {name: 'Quick options'}).click()
  await expect(page.getByText('Anchored on desktop')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', {name: 'Command'}).click()
  await expect(page.getByRole('combobox', {name: 'Search commands'})).toBeFocused()
  await page.keyboard.type('tools')
  await expect(page.getByRole('option', {name: /Open tools/})).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+K')
  await expect(page.getByRole('combobox', {name: 'Search commands'})).toBeFocused()
  await page.keyboard.press('Escape')

  const toggle = page.getByTestId('web-adapter-toggle-group')
  await toggle.getByRole('button', {name: 'Bold'}).focus()
  await page.keyboard.press('ArrowRight')
  await expect(toggle.getByRole('button', {name: 'Italic'})).toBeFocused()

  await expectNoAxeViolations(page, '[data-testid="web-ui-adapter-lab"]')
  expect(errors, errors.join('\n')).toEqual([])
  await page.screenshot({path: `${EVIDENCE}/ui-lab-1440.png`, fullPage: true})
})

test('desktop navigator reuses one dialog shell at 1024', async ({page}) => {
  const errors = await openLab(page, 1024, 900)
  const trigger = page.getByTestId('web-adapter-drawer-drill-in')
  await trigger.click()
  const shell = page.getByTestId('web-adapter-drill-in-drawer')
  await expect(shell).toHaveClass(/modula-web-dialog-popup/)
  await page.getByTestId('web-adapter-open-formatting').click()
  await expect(shell.locator('.modula-web-drawer-navigation-heading')).toContainText('Formatting')
  await page.getByTestId('web-adapter-open-font').click()
  await expect(shell.locator('.modula-web-drawer-navigation-heading')).toContainText('Font')
  await shell.getByRole('button', {name: 'Back to Formatting'}).click()
  await expect(page.getByTestId('web-adapter-open-font')).toBeFocused()
  await expectNoAxeViolations(page, '[data-testid="web-adapter-drill-in-drawer"]')
  await page.screenshot({path: `${EVIDENCE}/drill-in-desktop-1024.png`})
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  expect(errors, errors.join('\n')).toEqual([])
})

test('priority Profile and Activity More actions execute on mobile web', async ({page}) => {
  const errors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({width: 390, height: 844})
  await page.emulateMedia({colorScheme: 'dark'})

  await page.goto(new URL('/activity', BASE_URL).toString(), {waitUntil: 'networkidle'})
  await page.getByRole('button', {name: 'Activity actions'}).click()
  await expectSingleDrawerSurface(page)
  await page.getByRole('button', {name: 'Filters'}).click()
  const activityFilters = page.getByTestId('activity-filter-sheet')
  await expect(activityFilters).toBeVisible()
  await expect(activityFilters).toContainText('Filter activity')
  await expectSingleDrawerSurface(page)
  await expectNoAxeViolations(page, '[data-testid="activity-filter-sheet"]')
  await page.screenshot({path: `${EVIDENCE}/activity-filter-390-dark.png`})
  await page.keyboard.press('Escape')

  await page.goto(new URL('/profile/andrei.modula', BASE_URL).toString(), {waitUntil: 'networkidle'})
  await page.getByRole('button', {name: 'More profile actions'}).click()
  await expectSingleDrawerSurface(page)
  await expectNoAxeViolations(page, '.modula-web-drawer-popup[data-open]')
  await page.screenshot({path: `${EVIDENCE}/profile-more-390-dark.png`})
  await page.getByRole('button', {name: 'Report account'}).click()
  await expect(page).toHaveURL(/\/report\?targetType=profile&targetId=/)
  expect(errors, errors.join('\n')).toEqual([])
})

test('390 light drill-in stays one surface and restores state, scroll, and focus', async ({page}) => {
  const errors = await openLab(page, 390, 844)
  await page.getByTestId('web-adapter-theme-light').click()
  const trigger = page.getByTestId('web-adapter-drawer-drill-in')
  const historyLength = await page.evaluate(() => history.length)
  const url = page.url()
  await trigger.click()
  const shell = page.getByTestId('web-adapter-drill-in-drawer')
  const body = shell.locator('.modula-web-overlay-body')
  await expectSingleDrawerSurface(page)
  await expect(shell.locator('.modula-web-drawer-navigation-heading')).toContainText('Tools')
  await expectNoAxeViolations(page, '[data-testid="web-adapter-drill-in-drawer"]')
  await page.screenshot({path: `${EVIDENCE}/drawer-root-390-light.png`})

  await page.setViewportSize({width: 390, height: 600})
  const rootHeight = (await shell.boundingBox())?.height ?? 0
  const scrollBefore = await body.evaluate(node => {
    const element = node as HTMLElement
    element.scrollTop = Math.min(90, element.scrollHeight - element.clientHeight)
    return element.scrollTop
  })
  expect(scrollBefore).toBeGreaterThan(0)
  await page.getByTestId('web-adapter-open-formatting').click()
  await expectSingleDrawerSurface(page)
  await expect(shell.locator('.modula-web-drawer-navigation-page')).toHaveCount(2)
  await expect(shell.locator('.modula-web-drawer-navigation-page[hidden]')).toHaveCount(1)
  await expect(shell.locator('.modula-web-drawer-navigation-heading > h2')).toBeFocused()
  await expect(shell.locator('.modula-web-drawer-navigation-page[data-active="true"]')).toContainText('Reset formatting')
  await page.waitForTimeout(250)
  const formattingHeight = (await shell.boundingBox())?.height ?? 0
  expect(Math.abs(rootHeight - formattingHeight)).toBeGreaterThan(20)
  await expectNoAxeViolations(page, '[data-testid="web-adapter-drill-in-drawer"]')
  await page.setViewportSize({width: 390, height: 844})
  await page.screenshot({path: `${EVIDENCE}/drawer-formatting-390-light.png`})

  await page.getByTestId('web-adapter-open-font').click()
  await expectSingleDrawerSurface(page)
  await expect(shell.locator('.modula-web-drawer-navigation-page')).toHaveCount(3)
  await expect(shell.locator('.modula-web-drawer-navigation-page[hidden]')).toHaveCount(2)
  await expect(shell.locator('.modula-web-drawer-navigation-heading > h2')).toHaveText('Font')
  await expect(shell.locator('.modula-web-drawer-navigation-heading > h2')).toBeFocused()
  await page.screenshot({path: `${EVIDENCE}/drawer-font-390-light.png`})
  const fontSearch = shell.getByRole('textbox', {name: 'Search fonts'})
  await fontSearch.fill('Ser')
  await page.getByTestId('web-adapter-font-serif').click()
  await expectNoAxeViolations(page, '[data-testid="web-adapter-drill-in-drawer"]')

  await page.setViewportSize({width: 390, height: 600})
  await shell.getByRole('button', {name: 'Back to Formatting'}).click()
  await expect(page.getByTestId('web-adapter-open-font')).toBeFocused()
  await expect(shell.locator('.modula-web-drawer-navigation-page[data-active="true"]')).toContainText('Serif')
  await page.getByTestId('web-adapter-open-font').click()
  await expect(shell.getByRole('textbox', {name: 'Search fonts'})).toHaveValue('Ser')
  await shell.getByRole('button', {name: 'Back to Formatting'}).click()
  await shell.getByRole('button', {name: 'Back to Tools'}).click()
  await expect(page.getByTestId('web-adapter-open-formatting')).toBeFocused()
  await expect.poll(() => body.evaluate(node => (node as HTMLElement).scrollTop)).toBe(scrollBefore)
  await expectSingleDrawerSurface(page)
  await page.setViewportSize({width: 390, height: 844})
  await page.screenshot({path: `${EVIDENCE}/drawer-back-tools-390-light.png`})

  expect(await page.evaluate(() => history.length)).toBe(historyLength)
  expect(page.url()).toBe(url)
  await page.getByTestId('web-adapter-open-formatting').click()
  await page.keyboard.press('Escape')
  await expect(shell).toBeHidden()
  await expect(trigger).toBeFocused()
  expect(errors, errors.join('\n')).toEqual([])
})

test('430 dark, OLED true nesting, keyboard, long scroll, and accessibility preferences', async ({page}) => {
  const errors = await openLab(page, 430, 844)
  await page.getByTestId('web-adapter-theme-dark').click()
  await page.getByTestId('web-adapter-navigation-chrome').screenshot({
    path: `${EVIDENCE}/navigation-chrome-430-dark.png`,
  })

  const menuTrigger = page.getByRole('button', {name: 'Open adapter menu'})
  await menuTrigger.click()
  await expectSingleDrawerSurface(page)
  await page.getByRole('button', {name: 'Copy link'}).click()
  await expect(page.getByText('copy action selected', {exact: true})).toBeVisible()
  await expect(menuTrigger).toBeFocused()

  await menuTrigger.click()
  await page.getByRole('button', {name: 'Delete'}).click()
  const confirmation = page.getByTestId('modula-confirmation-dialog')
  await expect(confirmation).toBeVisible()
  await expectSingleDrawerSurface(page)
  await confirmation.getByRole('button', {name: 'Delete'}).click()
  await expect(page.getByText('Delete action confirmed', {exact: true})).toBeVisible()

  const sharedActionTrigger = page.getByRole('button', {name: 'Shared action presenter'})
  await sharedActionTrigger.click()
  await expectSingleDrawerSurface(page)
  await page.getByRole('button', {name: 'Copy example'}).click()
  await expect(page.getByText('shared-copy selected', {exact: true})).toBeVisible()
  await expect(sharedActionTrigger).toBeFocused()

  await menuTrigger.click()
  await expectSingleDrawerSurface(page)
  await page.getByRole('button', {name: 'Share'}).click()
  await expectSingleDrawerSurface(page)
  await expect(page.locator('.modula-web-drawer-navigation-heading')).toContainText('Share')
  await page.getByRole('button', {name: 'Back to Module actions'}).click()
  await expect(page.getByRole('button', {name: 'Share'})).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menuTrigger).toBeFocused()

  await page.getByTestId('web-adapter-drawer-drill-in').click()
  const navigationShell = page.getByTestId('web-adapter-drill-in-drawer')
  await page.getByTestId('web-adapter-open-formatting').click()
  await expectSingleDrawerSurface(page)
  await page.screenshot({path: `${EVIDENCE}/drawer-formatting-430-dark.png`})
  await page.keyboard.press('Escape')

  await page.getByTestId('web-adapter-drawer-input').click()
  const inputShell = page.getByTestId('web-adapter-active-drawer')
  await expect(inputShell.getByRole('textbox', {name: 'Drawer input'})).toBeFocused()
  await expect(inputShell.locator('.modula-web-overlay-footer')).toBeVisible()
  await page.setViewportSize({width: 844, height: 390})
  await expect(inputShell).toBeVisible()
  await page.setViewportSize({width: 430, height: 844})
  await page.screenshot({path: `${EVIDENCE}/drawer-input-keyboard-430-dark.png`})
  await page.keyboard.press('Escape')

  await page.getByTestId('web-adapter-drawer-long').click()
  const longShell = page.getByTestId('web-adapter-active-drawer')
  await longShell.locator('.modula-web-overlay-body').evaluate(node => { (node as HTMLElement).scrollTop = (node as HTMLElement).scrollHeight })
  await expect(longShell.getByText('Scrollable row 24')).toBeVisible()
  await page.screenshot({path: `${EVIDENCE}/drawer-long-child-430-dark.png`})
  await page.locator('.modula-web-drawer-backdrop:visible').click({position: {x: 5, y: 5}})
  await expect(longShell).toBeHidden()

  await page.getByTestId('web-adapter-theme-oled').click()
  await page.getByTestId('web-adapter-drawer-true-nested').click()
  const parent = page.getByTestId('web-adapter-active-drawer')
  await page.getByTestId('web-adapter-open-true-nested').click()
  const child = page.getByTestId('web-adapter-true-nested-modal')
  await expect(page.locator('.modula-web-drawer-popup:visible')).toHaveCount(2)
  await expect(parent).toHaveAttribute('data-nested-drawer-open', '')
  await expect(page.locator('.modula-web-drawer-handle-target:visible')).toHaveCount(1)
  expect(await parent.evaluate(node => !node.contains(document.querySelector('[data-testid="web-adapter-true-nested-modal"]')))).toBe(true)
  await expectNoAxeViolations(page, '[data-testid="web-adapter-true-nested-modal"]')
  await page.screenshot({path: `${EVIDENCE}/true-nested-modal-430-oled.png`})
  await page.keyboard.press('Escape')
  await expect(child).toBeHidden()
  await expect(parent).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByTestId('web-adapter-reduce-motion').click()
  await page.getByTestId('web-adapter-reduce-transparency').click()
  await page.getByTestId('web-adapter-increase-contrast').click()
  await page.getByTestId('web-adapter-drawer-drill-in').click()
  await expect(navigationShell.locator('.modula-web-drawer-navigation')).toHaveAttribute('data-reduce-motion', 'true')
  await page.getByTestId('web-adapter-open-formatting').click()
  await expect(navigationShell.locator('.modula-web-drawer-navigation-page[data-active="true"]')).toHaveCSS('animation-name', 'none')
  await page.keyboard.press('Escape')

  await page.evaluate(() => { document.documentElement.style.fontSize = '24px' })
  await page.getByTestId('web-adapter-drawer-drill-in').click()
  await page.getByTestId('web-adapter-open-formatting').click()
  await page.getByTestId('web-adapter-open-font').click()
  await expect(navigationShell.locator('.modula-web-drawer-navigation-heading > h2')).toBeVisible()
  await navigationShell.getByRole('textbox', {name: 'Search fonts'}).focus()
  await expect(navigationShell.locator('.modula-web-drawer-navigation-header')).toBeVisible()
  await expect(page.locator('.modula-web-overlay-body[data-scroll="true"]:visible')).toHaveCount(1)
  const noOverflow = await navigationShell.evaluate(node => node.scrollWidth <= node.clientWidth)
  expect(noOverflow).toBe(true)
  await expectNoAxeViolations(page, '[data-testid="web-adapter-drill-in-drawer"]')
  await page.keyboard.press('Escape')
  expect(errors, errors.join('\n')).toEqual([])
})

test('records the drill-in and drag-close interaction', async ({browser}) => {
  const context = await browser.newContext({
    baseURL: process.env.MODULA_BROWSER_BASE_URL ?? 'http://127.0.0.1:4174',
    recordVideo: {dir: 'test-results/web-ui-adapter-video', size: {width: 390, height: 844}},
    viewport: {width: 390, height: 844},
  })
  const page = await context.newPage()
  await openLab(page, 390, 844)
  await page.getByTestId('web-adapter-drawer-drill-in').click()
  const shell = page.getByTestId('web-adapter-drill-in-drawer')
  await page.getByTestId('web-adapter-open-formatting').click()
  await page.waitForTimeout(300)
  await page.getByTestId('web-adapter-open-font').click()
  await page.waitForTimeout(300)
  await page.getByTestId('web-adapter-font-monospace').click()
  await shell.getByRole('button', {name: 'Back to Formatting'}).click()
  await page.waitForTimeout(250)
  await shell.getByRole('button', {name: 'Back to Tools'}).click()
  await page.waitForTimeout(250)
  const handle = shell.locator('.modula-web-drawer-handle-target')
  const box = await handle.boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 260, {steps: 12})
    await page.mouse.up()
  }
  await expect(shell).toBeHidden()
  const video = page.video()
  await context.close()
  await video?.saveAs(`${EVIDENCE}/drawer-drill-in-flow-390.webm`)
})
