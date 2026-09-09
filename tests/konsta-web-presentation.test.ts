import Axe from '@axe-core/playwright'
import {expect, test, type Page} from '@playwright/test'
import {createHash} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'

const ROUTE = '/settings/developer/modula-ui-lab'
const STORAGE_KEY = 'modula.appearance.preferences.v1'
const EVIDENCE = 'docs/validation/konsta-web-presentation'
const VAULT_ARTIFACT_PATH = process.env.MODULA_VAULT_NOTES_ARTIFACT
  ?? '/root/modula-mod/modula-vault-notes/frontend/frontend.manifest.json'
const VAULT_ARTIFACT_SHA = '4af252f64b8b55d18d10c827f1c998845256b985cfa664326284107871595d7d'

function apiEnvelope(data: unknown) {
  return {
    ok: true,
    data,
    meta: {requestId: 'konsta-browser-proof', serverTime: '2026-09-09T12:00:00.000Z'},
  }
}

async function installVaultRuntimeFixture(page: Page, frontend: Record<string, unknown>) {
  const future = '2099-01-01T00:00:00.000Z'
  await page.addInitScript(({future}) => {
    localStorage.setItem('modula.web.session.bundle.v1', JSON.stringify({
      accessToken: 'konsta-proof-access',
      refreshToken: 'konsta-proof-refresh',
      sessionId: 'konsta-proof-session',
      accessTokenExpiresAt: future,
      refreshTokenExpiresAt: future,
    }))
  }, {future})
  await page.route('https://api.modula.digital/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({status: 204})
      return
    }
    let data: unknown = {}
    if (path === '/v1/sessions/refresh') {
      data = {
        accessToken: 'konsta-proof-access-next',
        refreshToken: 'konsta-proof-refresh-next',
        sessionId: 'konsta-proof-session',
        accessExpiresAt: future,
        refreshExpiresAt: future,
      }
    } else if (path === '/v1/accounts/me') {
      data = {
        accountId: 'account-konsta-proof',
        primaryHandle: 'konsta.proof',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-09-09T00:00:00.000Z',
        email: 'proof@example.test',
      }
    } else if (path === '/v1/profiles/konsta.proof') {
      data = {
        id: 'profile-konsta-proof',
        handle: 'konsta.proof',
        displayName: 'Presentation Proof',
        kind: 'person',
        bio: '',
        followerCount: 0,
        followingCount: 0,
        moduleCount: 1,
        postCount: 0,
        joinedAt: '2026-01-01T00:00:00.000Z',
        focusStatus: {id: 'available', label: 'Available', message: '', updatedAt: '2026-09-09T00:00:00.000Z'},
        identityClaims: [],
        links: [],
        featuredModuleIds: ['digital.modula.vault-notes'],
        isFollowing: false,
        followsViewer: false,
      }
    } else if (path === '/v1/accounts/me/appearance') {
      data = {mode: 'light', variant: 'standard', surface: 'native', accentId: 'modulaTeal', version: 0}
    } else if (path === '/v1/registry/products') {
      data = {
        items: [{
          moduleId: 'digital.modula.vault-notes',
          name: 'Vault Notes',
          description: 'Private notes and knowledge, built into Modula.',
          publisherId: 'modula',
          publisherName: 'Modula',
          status: 'published',
          latestVersion: '1.7.0',
          productKind: 'module',
          installable: true,
          installationState: 'enabled',
          featured: true,
          installability: {
            moduleId: 'digital.modula.vault-notes',
            release: {version: '1.7.0', releaseId: 'vault-notes-1.7.0'},
            status: 'installed',
            reasonCode: 'module.installed',
            reason: 'Installed',
          },
        }],
      }
    } else if (path === '/v1/registry/products/digital.modula.vault-notes') {
      data = {
        moduleId: 'digital.modula.vault-notes',
        name: 'Vault Notes',
        description: 'Private notes and knowledge, built into Modula.',
        publisherId: 'modula',
        publisherName: 'Modula',
        status: 'published',
        latestVersion: '1.7.0',
        productKind: 'module',
        installable: true,
        installationState: 'enabled',
        installability: {
          moduleId: 'digital.modula.vault-notes',
          release: {version: '1.7.0', releaseId: 'vault-notes-1.7.0'},
          status: 'installed',
          reasonCode: 'module.installed',
          reason: 'Installed',
        },
      }
    } else if (path === '/v1/modules/installed') {
      data = [{
        installationId: 'vault-notes-installation',
        moduleId: 'digital.modula.vault-notes',
        version: '1.7.0',
        status: 'enabled',
        lifecycleState: 'ENABLED',
      }]
    } else if (path === '/v1/modules/digital.modula.vault-notes/frontend') {
      data = {
        source: 'mps',
        productId: 'digital.modula.vault-notes',
        version: '1.7.0',
        releaseId: 'vault-notes-1.7.0',
        installationId: 'vault-notes-installation',
        installationStatus: 'enabled',
        mode: 'declarative',
        artifact: {
          role: 'product.frontend',
          path: 'frontend/frontend.manifest.json',
          mediaType: 'application/vnd.modula.frontend+json',
          sha256: VAULT_ARTIFACT_SHA,
          schemaVersion: '1.0.0',
          verifiedAt: '2026-09-05T00:00:00.000Z',
        },
        mpsVersion: '1.0',
        entryView: 'home',
        routeCount: Array.isArray(frontend.routes) ? frontend.routes.length : 0,
        compatibility: frontend.hostRuntime ?? {},
        requiredCapabilities: [],
        frontend,
      }
    } else if (path === '/v1/module-host/digital.modula.vault-notes/composition') {
      data = {
        target: {productId: 'digital.modula.vault-notes', installationId: 'vault-notes-installation', version: '1.7.0', status: 'enabled'},
        route: '',
        platform: 'web',
        core: {manifest: {}, extensionPoints: []},
        extensions: [],
        failureIsolation: true,
        arbitraryRemoteCode: false,
      }
    } else if (path === '/v1/modules/digital.modula.vault-notes/records/note') {
      data = {
        moduleId: 'digital.modula.vault-notes',
        collection: 'note',
        items: [{
          record_id: 'architecture-proof',
          collection: 'note',
          data: {title: 'Architecture proof', document: {type: 'doc', content: []}, archived: false},
          revision: 1,
          visibility: 'private',
        }],
        nextCursor: null,
        limit: 25,
      }
    }
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify(apiEnvelope(data)),
    })
  })
}

async function openCleanLab(page: Page, width = 1440, height = 1000) {
  await page.addInitScript(key => {
    if (window.sessionStorage.getItem('__modula_konsta_test_ready')) return
    window.localStorage.removeItem(key)
    window.sessionStorage.setItem('__modula_konsta_test_ready', 'true')
  }, STORAGE_KEY)
  await page.setViewportSize({width, height})
  await page.goto(ROUTE, {waitUntil: 'networkidle'})
  await expect(page.getByTestId('web-ui-adapter-lab')).toBeVisible()
}

function presentationControl(page: Page, testID = 'web-adapter-presentation') {
  return page.locator(`[data-testid="${testID}"]:visible`)
}

async function choosePresentation(page: Page, value: 'Liquid' | 'Material', testID?: string) {
  await presentationControl(page, testID).getByRole('tab', {name: value}).click()
  await expect(page.locator('.modula-konsta-root')).toHaveAttribute(
    'data-modula-presentation',
    value.toLowerCase(),
  )
}

async function changePresentationWithoutPointerDismissal(page: Page, value: 'Liquid' | 'Material') {
  await page
    .locator('[data-testid="web-adapter-presentation"] button', {hasText: value})
    .evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator('.modula-konsta-root')).toHaveAttribute(
    'data-modula-presentation',
    value.toLowerCase(),
  )
}

test('defaults to Liquid, maps classes atomically, persists, and preserves the route', async ({page}) => {
  await openCleanLab(page)
  const route = page.url()
  const historyLength = await page.evaluate(() => history.length)
  const root = page.locator('.modula-konsta-root')
  const html = page.locator('html')

  await expect(root).toHaveAttribute('data-modula-presentation', 'liquid')
  await expect(root).toHaveClass(/\bk-ios\b/)
  await expect(root).not.toHaveClass(/\bk-material\b/)
  await expect(html).toHaveClass(/\bk-ios\b/)

  await choosePresentation(page, 'Material')
  await expect(root).toHaveClass(/\bk-material\b/)
  await expect(root).not.toHaveClass(/\bk-ios\b/)
  await expect(html).toHaveClass(/\bk-material\b/)
  await expect(html).not.toHaveClass(/\bk-ios\b/)
  expect(page.url()).toBe(route)
  expect(await page.evaluate(() => history.length)).toBe(historyLength)

  await expect.poll(() => page.evaluate(key => {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return (parsed.preferences ?? parsed).webPresentation
  }, STORAGE_KEY)).toBe('material')

  await page.reload({waitUntil: 'networkidle'})
  await expect(page.locator('.modula-konsta-root')).toHaveAttribute('data-modula-presentation', 'material')
  await expect(page.locator('html')).toHaveClass(/\bk-material\b/)
})

test('keeps draft, selection, drawer route and generated colours across a live switch', async ({page}) => {
  await openCleanLab(page, 390, 844)
  const draft = page.getByTestId('web-adapter-unsaved-note')
  await draft.fill('Draft text remains intact')
  await draft.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(6, 10))
  const route = page.url()
  const historyLength = await page.evaluate(() => history.length)

  await page.getByTestId('web-adapter-open-editor-tools').click()
  const shell = page.getByTestId('web-adapter-drill-in-drawer')
  await page.getByTestId('web-adapter-open-formatting').click()
  await page.getByTestId('web-adapter-open-font').click()
  await shell.getByRole('textbox', {name: 'Search fonts'}).fill('Ser')
  await page.getByTestId('web-adapter-font-serif').click()
  await expect(shell.locator('.modula-web-drawer-navigation-heading > h2')).toHaveText('Font')

  const beforeAccent = await page.locator('html').evaluate(element =>
    element.style.getPropertyValue('--k-color-primary'),
  )
  await choosePresentation(page, 'Material', 'web-adapter-open-overlay-presentation')
  await expect(shell).toBeVisible()
  await expect(shell.locator('.modula-web-drawer-navigation-heading > h2')).toHaveText('Font')
  await expect(shell.getByRole('textbox', {name: 'Search fonts'})).toHaveValue('Ser')
  await expect(draft).toHaveValue('Draft text remains intact')
  expect(await draft.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([6, 10])

  await page.locator('[data-testid="web-adapter-open-overlay-accent-violet"]:visible').click()
  await expect.poll(() => page.locator('html').evaluate(element =>
    element.style.getPropertyValue('--k-color-primary'),
  )).not.toBe(beforeAccent)
  const colourBridge = await shell.evaluate(element => {
    const styles = getComputedStyle(element)
    return {
      primary: styles.getPropertyValue('--k-color-primary').trim(),
      onPrimary: styles.getPropertyValue('--k-color-md-light-on-primary').trim(),
      surface: styles.getPropertyValue('--k-color-md-light-surface').trim(),
      outline: styles.getPropertyValue('--k-color-md-light-outline').trim(),
    }
  })
  expect(colourBridge.primary).not.toBe('')
  expect(colourBridge.onPrimary).not.toBe('')
  expect(colourBridge.surface).not.toBe('')
  expect(colourBridge.outline).not.toBe('')

  await page.setViewportSize({width: 1024, height: 768})
  await expect(shell).toBeVisible()
  await expect(shell.locator('.modula-web-drawer-navigation-heading > h2')).toHaveText('Font')
  await expect(shell.getByRole('textbox', {name: 'Search fonts'})).toHaveValue('Ser')
  expect(page.url()).toBe(route)
  expect(await page.evaluate(() => history.length)).toBe(historyLength)

  await page.keyboard.press('Escape')
  await expect(shell).toBeHidden()
  await expect(page.getByTestId('web-adapter-open-editor-tools')).toBeFocused()
  await page.getByTestId('web-adapter-save-note').click()
  await expect(page.getByTestId('web-adapter-save-evidence')).toContainText('Saves: 1 · Draft text remains intact')
  await expect(page.getByTestId('web-adapter-save-note')).toHaveAttribute('type', 'button')
})

test('keeps dialog, sheet, popover, menu and toast presentation-aware in their portals', async ({page}) => {
  await openCleanLab(page, 1024, 900)

  await page.getByRole('button', {name: 'small', exact: true}).click()
  const dialog = page.locator('.modula-web-dialog-popup:visible')
  await expect(dialog).toBeVisible()
  await choosePresentation(page, 'Material', 'web-adapter-open-overlay-presentation')
  await expect(page.locator('.modula-web-dialog-popup')).toBeVisible()
  await page.getByRole('button', {name: 'Open dialog menu'}).click()
  const menu = page.locator('.modula-web-menu-popup:visible')
  await expect(menu).toBeVisible()
  const layers = await page.evaluate(() => ({
    dialog: Number.parseInt(getComputedStyle(document.querySelector('.modula-web-dialog-viewport')!).zIndex, 10),
    menu: Number.parseInt(getComputedStyle(document.querySelector('.modula-web-menu-positioner:has(.modula-web-menu-popup:not([hidden]))')!).zIndex, 10),
  }))
  expect(layers.menu).toBeGreaterThan(layers.dialog)
  await changePresentationWithoutPointerDismissal(page, 'Liquid')
  await expect(menu).toBeVisible()
  await expect(page.locator('.modula-konsta-root')).toHaveAttribute('data-modula-presentation', 'liquid')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.getByRole('button', {name: 'right', exact: true}).click()
  const sheet = page.locator('.modula-web-edge-sheet:visible')
  await expect(sheet).toBeVisible()
  await choosePresentation(page, 'Material', 'web-adapter-open-overlay-presentation')
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  await page.getByRole('button', {name: 'Quick options'}).click()
  const popover = page.locator('.modula-web-popover-popup:visible')
  await expect(popover).toBeVisible()
  await choosePresentation(page, 'Liquid', 'web-adapter-open-overlay-presentation')
  await expect(popover).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', {name: 'Success toast'}).click()
  const toast = page.locator('.modula-web-toast:visible')
  await expect(toast).toBeVisible()
  await toast.evaluate(element => { (window as Window & {__modulaToast?: Element}).__modulaToast = element })
  await changePresentationWithoutPointerDismissal(page, 'Material')
  await expect(toast).toBeVisible()
  expect(await toast.evaluate(element => (window as Window & {__modulaToast?: Element}).__modulaToast === element)).toBe(true)
})

test('Escape cancels destructive confirmation with safer initial focus', async ({page}) => {
  await openCleanLab(page, 1024, 900)
  const trigger = page.getByRole('button', {name: 'Open adapter menu'})
  await trigger.click()
  await page.getByRole('menuitem', {name: 'Delete'}).click()
  const confirmation = page.getByTestId('modula-confirmation-dialog')
  await expect(confirmation).toBeVisible()
  await expect(confirmation.getByRole('button', {name: 'Cancel'})).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(confirmation).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect(page.locator('.modula-web-toast:visible')).toContainText('Delete action cancelled')
})

test('catalogue specimens remain accessible without horizontal overflow', async ({page}) => {
  await openCleanLab(page, 1440, 1100)
  await choosePresentation(page, 'Material')
  const axe = await new Axe({page}).include('[data-testid="web-ui-adapter-lab"]').analyze()
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([])
  expect(await page.locator('body').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.screenshot({path: `${EVIDENCE}/ui-lab-material-light-1440.png`, fullPage: true})
})

test('representative Settings and Product Hub use the live presentation setting', async ({page}) => {
  await installVaultRuntimeFixture(page, {})
  await page.setViewportSize({width: 1440, height: 1000})
  await page.goto('/settings/appearance', {waitUntil: 'networkidle'})
  await expect(page.getByRole('heading', {name: 'Appearance'})).toBeVisible()
  const route = page.url()
  const switcher = page.getByTestId('appearance-web-presentation')
  await expect(switcher).toBeVisible()
  await expect(page.locator('.modula-konsta-root')).toHaveAttribute('data-modula-presentation', 'liquid')
  await page.screenshot({path: `${EVIDENCE}/settings-liquid-1440.png`, fullPage: true})

  await switcher.getByRole('tab', {name: 'Material'}).click()
  await expect(page.locator('.modula-konsta-root')).toHaveAttribute('data-modula-presentation', 'material')
  expect(page.url()).toBe(route)
  await page.screenshot({path: `${EVIDENCE}/settings-material-1440.png`, fullPage: true})

  await page.goto('/marketplace', {waitUntil: 'networkidle'})
  await expect(page.getByTestId('product-hub-browse')).toBeVisible()
  await expect(page.locator('.modula-konsta-root')).toHaveAttribute('data-modula-presentation', 'material')
  await page.screenshot({path: `${EVIDENCE}/product-hub-material-1440.png`, fullPage: true})

  await page.goto('/settings/appearance', {waitUntil: 'networkidle'})
  await page.getByTestId('appearance-web-presentation').getByRole('tab', {name: 'Liquid'}).click()
  await expect(page.locator('.modula-konsta-root')).toHaveAttribute('data-modula-presentation', 'liquid')
  await page.goto('/marketplace', {waitUntil: 'networkidle'})
  await expect(page.getByTestId('product-hub-browse')).toBeVisible()
  await expect(page.locator('.modula-konsta-root')).toHaveAttribute('data-modula-presentation', 'liquid')
  await page.screenshot({path: `${EVIDENCE}/product-hub-liquid-1440.png`, fullPage: true})
})

test('renders the same published Vault Notes artifact in Liquid and Material', async ({page}) => {
  test.skip(!existsSync(VAULT_ARTIFACT_PATH), 'Canonical Vault Notes 1.7.0 artifact is required')
  const artifactBytes = readFileSync(VAULT_ARTIFACT_PATH)
  expect(createHash('sha256').update(artifactBytes).digest('hex')).toBe(VAULT_ARTIFACT_SHA)
  const frontend = JSON.parse(artifactBytes.toString('utf8')) as Record<string, unknown>
  await installVaultRuntimeFixture(page, frontend)
  await page.setViewportSize({width: 1024, height: 900})
  await page.goto('/module/digital.modula.vault-notes', {waitUntil: 'networkidle'})
  await expect(page.getByText('Loading module', {exact: true})).toBeHidden()
  await expect(page.getByText('Vault Notes', {exact: true}).first()).toBeVisible()
  await expect(page.getByTestId('module-record-search')).toBeVisible()
  await expect(page.getByText('Architecture proof', {exact: true})).toBeVisible()
  await expect(page.locator('.modula-konsta-root')).toHaveAttribute('data-modula-presentation', 'liquid')
  await page.screenshot({path: `${EVIDENCE}/vault-notes-liquid-1024.png`, fullPage: true})

  await page.evaluate(key => {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : {preferences: {}}
    parsed.preferences = {...(parsed.preferences ?? parsed), webPresentation: 'material'}
    localStorage.setItem(key, JSON.stringify(parsed))
  }, STORAGE_KEY)
  await page.reload({waitUntil: 'networkidle'})
  await expect(page.locator('.modula-konsta-root')).toHaveAttribute('data-modula-presentation', 'material')
  await expect(page.getByText('Vault Notes', {exact: true}).first()).toBeVisible()
  await expect(page.getByText('Architecture proof', {exact: true})).toBeVisible()
  await page.screenshot({path: `${EVIDENCE}/vault-notes-material-1024.png`, fullPage: true})
  expect(createHash('sha256').update(readFileSync(VAULT_ARTIFACT_PATH)).digest('hex')).toBe(VAULT_ARTIFACT_SHA)
})
