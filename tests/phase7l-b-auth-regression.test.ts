import {execFileSync} from 'node:child_process'
import {setTimeout as sleep} from 'node:timers/promises'
import {expect, test, type Browser, type Page} from '@playwright/test'

const apiBaseURL = process.env.MODULA_PUBLIC_API_URL ?? 'http://127.0.0.1:4022'
const apiOrigin = new URL(apiBaseURL).origin
const sessionBundleKey = 'modula.web.session.bundle.v1'
const databaseUrl = process.env.MODULA_TEST_DATABASE_URL ?? process.env.MODULA_DATABASE_URL
let directApiRequestCounter = 0

if (!databaseUrl) {
  throw new Error('MODULA_TEST_DATABASE_URL or MODULA_DATABASE_URL is required.')
}

type ApiEnvelope<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: {
        code: string
        message: string
      }
    }

type RegisterResult = {
  accountId: string
  primaryHandle: string
  verificationChallengeId: string
}

type RecoveryResult = {
  requested: boolean
  recoveryToken?: string
}

type SessionTokenResult = {
  accessToken: string
  refreshToken: string
  sessionId: string
}

type StoredSessionBundle = {
  accessToken?: string
  refreshToken?: string
  sessionId?: string
  accessTokenExpiresAt?: string
  refreshTokenExpiresAt?: string
}

type TestAccount = {
  accountId: string
  email: string
  handle: string
  password: string
}

type BrowserEvent = {
  type: string
  text: string
}

type AssetResponse = {
  contentType: string
  status: number
  url: string
}

type AllowedHttpError = {
  status: number
  method: string
  path: string
}

test.describe.configure({mode: 'serial'})

function apiURL(path: string): string {
  return new URL(path, apiOrigin).toString()
}

function matchesApiResponse(path: string, method: string) {
  return (response: {url(): string; request(): {method(): string}}) => {
    const url = new URL(response.url())
    return url.origin === apiOrigin && url.pathname === path && response.request().method() === method
  }
}

function matchesSearchQueryResponse(query: string) {
  return (response: {url(): string; request(): {method(): string}}) => {
    const url = new URL(response.url())
    return (
      url.origin === apiOrigin &&
      url.pathname === '/v1/search' &&
      url.searchParams.get('query') === query &&
      response.request().method() === 'GET'
    )
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function psqlArgsFromDatabaseUrl() {
  const url = new URL(databaseUrl!)
  return {
    args: [
      '-h',
      url.hostname,
      '-p',
      url.port || '5432',
      '-U',
      decodeURIComponent(url.username),
      '-d',
      decodeURIComponent(url.pathname.replace(/^\//, '')),
      '-At',
    ],
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(url.password),
    },
  }
}

function queryScalar(sql: string): string {
  const {args, env} = psqlArgsFromDatabaseUrl()
  return execFileSync('psql', [...args, '-c', sql], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function executeSql(sql: string): void {
  const {args, env} = psqlArgsFromDatabaseUrl()
  execFileSync('psql', [...args, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function sqlJson(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`
}

function sqlTextArray(values: string[]): string {
  return `ARRAY[${values.map(sqlLiteral).join(',')}]::text[]`
}

type SearchFixture = {
  query: string
  profileTitle: string
  firstPostTitle: string
  moduleTitle: string
}

function seedUniversalSearchDocuments(account: TestAccount): SearchFixture {
  const actorId = queryScalar(`
    select id
    from actors
    where account_id = ${sqlLiteral(account.accountId)}
      and deleted_at is null
    order by created_at asc
    limit 1
  `)
  if (!actorId) throw new Error(`No actor row exists for ${account.accountId}.`)
  const profileId = queryScalar(`
    select id
    from profiles
    where actor_id = ${sqlLiteral(actorId)}
      and deleted_at is null
    limit 1
  `)
  if (!profileId) throw new Error(`No profile row exists for ${actorId}.`)

  const query = `routeatlas${account.handle}`
  const profileTitle = `Phase 7L Search Profile ${query}`
  const firstPostTitle = `Phase 7L Search Post 1 ${query}`
  const moduleTitle = `Phase 7L Search Module ${query}`
  const documents = [
    {
      entityType: 'profile',
      entityId: profileId,
      ownerId: actorId,
      title: profileTitle,
      body: `Public profile proof for ${query}.`,
      summary: `Profile search proof ${query}.`,
      keywords: [query, account.handle, 'profile'],
      tags: ['phase7lb', 'search'],
      metadata: {handle: account.handle, kind: 'person'},
      updatedAt: new Date(Date.now() - 1_000).toISOString(),
    },
    {
      entityType: 'module',
      entityId: `digital.modula.routeatlas.${account.handle}`,
      ownerId: actorId,
      title: moduleTitle,
      body: `Module catalogue proof for ${query}.`,
      summary: `Module search proof ${query}.`,
      keywords: [query, 'module'],
      tags: ['phase7lb', 'search'],
      metadata: {
        publisher: 'Modula',
        trustState: 'firstParty',
        status: 'published',
        installable: true,
      },
      updatedAt: new Date(Date.now() - 2_000).toISOString(),
    },
    ...Array.from({length: 5}, (_, index) => ({
      entityType: 'post',
      entityId: `phase7lb-search-post-${account.handle}-${index + 1}`,
      ownerId: actorId,
      title: index === 0 ? firstPostTitle : `Phase 7L Search Post ${index + 1} ${query}`,
      body: `Search pagination proof post ${index + 1} for ${query}.`,
      summary: `Post search proof ${query} ${index + 1}.`,
      keywords: [query, 'post', `page${index + 1}`],
      tags: ['phase7lb', 'search'],
      metadata: {
        handle: account.handle,
        authorDisplayName: 'Phase 7L Search User',
        kind: 'text',
        feed: 'following',
        audience: 'public',
      },
      updatedAt: new Date(Date.now() - (index + 3) * 1_000).toISOString(),
    })),
  ]

  for (const document of documents) {
    const searchableText = [
      document.title,
      document.summary,
      document.body,
      document.keywords.join(' '),
      document.tags.join(' '),
    ].join(' ')
    executeSql(`
      insert into search_documents (
        document_id,
        schema_version,
        entity_type,
        entity_id,
        source_version,
        account_id,
        owner_id,
        title,
        body,
        summary,
        keywords,
        tags,
        visibility,
        status,
        language,
        metadata,
        created_at,
        updated_at,
        indexed_at,
        search_vector
      )
      values (
        ${sqlLiteral(`${document.entityType}:${document.entityId}`)},
        '1.0.0',
        ${sqlLiteral(document.entityType)},
        ${sqlLiteral(document.entityId)},
        1,
        ${sqlLiteral(account.accountId)},
        ${sqlLiteral(document.ownerId)},
        ${sqlLiteral(document.title)},
        ${sqlLiteral(document.body)},
        ${sqlLiteral(document.summary)},
        ${sqlTextArray(document.keywords)},
        ${sqlTextArray(document.tags)},
        'public',
        'active',
        'en',
        ${sqlJson(document.metadata)},
        ${sqlLiteral(document.updatedAt)}::timestamptz,
        ${sqlLiteral(document.updatedAt)}::timestamptz,
        now(),
        to_tsvector('english', ${sqlLiteral(searchableText)})
      )
      on conflict (entity_type, entity_id) do update set
        source_version = excluded.source_version,
        account_id = excluded.account_id,
        owner_id = excluded.owner_id,
        title = excluded.title,
        body = excluded.body,
        summary = excluded.summary,
        keywords = excluded.keywords,
        tags = excluded.tags,
        visibility = excluded.visibility,
        status = excluded.status,
        language = excluded.language,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at,
        indexed_at = excluded.indexed_at,
        search_vector = excluded.search_vector
    `)
  }

  return {query, profileTitle, firstPostTitle, moduleTitle}
}

async function latestMailCode(accountId: string, templateId: 'verification-code' | 'passwordless-login') {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = queryScalar(`
      select substring(text_body from '[0-9]{6,8}')
      from greenfield_mail_jobs
      where recipient_account_id = ${sqlLiteral(accountId)}
        and template_id = ${sqlLiteral(templateId)}
      order by created_at desc
      limit 1
    `)
    if (/^\d{6,8}$/.test(code)) return code
    await sleep(250)
  }
  throw new Error(`No ${templateId} code was queued for ${accountId}.`)
}

async function apiJson<T>(path: string, init: RequestInit): Promise<{response: Response; body: ApiEnvelope<T>}> {
  directApiRequestCounter += 1
  const response = await fetch(apiURL(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `203.0.113.${directApiRequestCounter}`,
      ...(init.headers ?? {}),
    },
  })
  const body = (await response.json()) as ApiEnvelope<T>
  return {response, body}
}

async function createVerifiedAccount(prefix: string): Promise<TestAccount> {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const handle = `p7lb${prefix}${unique}`.replace(/[^a-z0-9]/g, '').slice(0, 20)
  const email = `phase7lb-${prefix}-${unique}@example.com`
  const password = `Phase7LB-${unique}-password`
  const register = await apiJson<RegisterResult>('/v1/accounts/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      handle,
      displayName: `Phase 7L ${prefix} User`,
      acceptedTerms: true,
    }),
  })

  expect(register.response.status).toBe(201)
  if (!register.body.ok) throw new Error(register.body.error.message)

  const code = await latestMailCode(register.body.data.accountId, 'verification-code')
  const verify = await apiJson<{verified: boolean}>('/v1/accounts/verify-email', {
    method: 'POST',
    body: JSON.stringify({
      challengeId: register.body.data.verificationChallengeId,
      code,
    }),
  })
  expect(verify.response.status).toBe(200)
  if (!verify.body.ok) throw new Error(verify.body.error.message)

  return {
    accountId: register.body.data.accountId,
    email,
    handle: register.body.data.primaryHandle,
    password,
  }
}

function createAccountInput(prefix: string): TestAccount {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const handle = `p7lb${prefix}${unique}`.replace(/[^a-z0-9]/g, '').slice(0, 20)
  return {
    accountId: '',
    email: `phase7lb-${prefix}-${unique}@example.com`,
    handle,
    password: `Phase7LB-${unique}-password`,
  }
}

function collectCriticalEvents(page: Page): BrowserEvent[] {
  const events: BrowserEvent[] = []
  page.on('pageerror', error => {
    events.push({type: 'pageerror', text: `${page.url()} ${error.stack ?? error.message}`})
  })
  page.on('console', message => {
    if (message.type() === 'error') {
      if (/^Failed to load resource: the server responded with a status of \d+/.test(message.text())) {
        return
      }
      events.push({type: 'console.error', text: message.text()})
    }
  })
  page.on('response', response => {
    if (response.status() < 400) return
    events.push({
      type: 'http.error',
      text: `${response.status()} ${response.request().method()} ${response.url()}`,
    })
  })
  page.on('requestfailed', request => {
    events.push({
      type: 'requestfailed',
      text: `${request.failure()?.errorText ?? 'unknown'} ${request.url()}`,
    })
  })
  return events
}

function matchesAllowedHttpError(event: BrowserEvent, allowed: AllowedHttpError) {
  if (event.type !== 'http.error') return false
  const match = /^(\d+) ([A-Z]+) (.+)$/.exec(event.text)
  if (!match) return false
  const [, status, method, urlValue] = match
  const url = new URL(urlValue)
  return (
    Number(status) === allowed.status &&
    method === allowed.method &&
    url.origin === apiOrigin &&
    url.pathname === allowed.path
  )
}

function expectNoCriticalEvents(events: BrowserEvent[], allowedHttpErrors: AllowedHttpError[] = []) {
  const critical = events.filter(event => {
    if (/Minified React error #418|hydration/i.test(event.text)) return true
    if (event.type === 'pageerror') return true
    if (allowedHttpErrors.some(allowed => matchesAllowedHttpError(event, allowed))) {
      return false
    }
    if (event.type === 'http.error') return true
    if (event.type === 'console.error') return true
    if (event.type === 'requestfailed') return true
    return false
  })
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([])
}

function collectAssetResponses(page: Page): AssetResponse[] {
  const responses: AssetResponse[] = []
  page.on('response', response => {
    const pathname = new URL(response.url()).pathname
    if (!/\.(?:ttf|otf|woff2?|png|jpe?g|webp|svg)(?:$|\?)/i.test(pathname)) return
    responses.push({
      contentType: response.headers()['content-type'] ?? '',
      status: response.status(),
      url: response.url(),
    })
  })
  return responses
}

function expectStaticAssetResponsesHealthy(responses: AssetResponse[]) {
  const failures = responses.filter(response => response.status !== 200)
  expect(failures, JSON.stringify(failures, null, 2)).toEqual([])

  const mimeFailures = responses.filter(response => {
    const path = new URL(response.url).pathname
    const contentType = response.contentType.toLowerCase()
    if (/\.(?:ttf|otf|woff2?)$/i.test(path)) {
      return !/(font|application\/octet-stream|application\/x-font)/.test(contentType)
    }
    if (/\.svg$/i.test(path)) return !contentType.includes('image/svg')
    if (/\.png$/i.test(path)) return !contentType.includes('image/png')
    if (/\.jpe?g$/i.test(path)) return !contentType.includes('image/jpeg')
    if (/\.webp$/i.test(path)) return !contentType.includes('image/webp')
    return false
  })
  expect(mimeFailures, JSON.stringify(mimeFailures, null, 2)).toEqual([])

  const ioniconsFont = responses.find(response => {
    const path = new URL(response.url).pathname
    return /ionicons/i.test(path) && /\.(?:ttf|otf|woff2?)$/i.test(path)
  })
  expect(ioniconsFont, JSON.stringify(responses, null, 2)).toBeTruthy()
}

async function expectIoniconsReady(page: Page) {
  const audit = await page.evaluate(async () => {
    if (!('fonts' in document)) {
      return {
        fontsApiAvailable: false,
        ioniconsReady: false,
        loadedIoniconsFamilies: [],
        privateUseGlyphCount: 0,
      }
    }

    await document.fonts.ready
    const loadedIoniconsFamilies = Array.from(document.fonts)
      .filter(fontFace => fontFace.status === 'loaded' && /ionicons/i.test(fontFace.family))
      .map(fontFace => fontFace.family)
    const privateUseGlyphCount =
      (document.body.innerText.match(/[\ue000-\uf8ff]/g) ?? []).length

    return {
      fontsApiAvailable: true,
      ioniconsReady: loadedIoniconsFamilies.some(family =>
        document.fonts.check(`16px ${JSON.stringify(family)}`),
      ),
      loadedIoniconsFamilies,
      privateUseGlyphCount,
    }
  })

  expect(audit.fontsApiAvailable).toBe(true)
  expect(audit.ioniconsReady).toBe(true)
  expect(audit.loadedIoniconsFamilies, JSON.stringify(audit, null, 2)).not.toHaveLength(0)
  expect(audit.privateUseGlyphCount, JSON.stringify(audit, null, 2)).toBeGreaterThan(0)
}

async function expectNoFallbackGlyphText(page: Page) {
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toMatch(/(?:\u25a1|\ufffd)/)
}

async function gotoProtectedRoute(page: Page, path: string) {
  await page.goto(path, {waitUntil: 'networkidle'})
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`))
}

async function readStoredSession(page: Page): Promise<StoredSessionBundle | null> {
  return page.evaluate(key => {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as StoredSessionBundle) : null
  }, sessionBundleKey)
}

async function expectStoredSession(page: Page): Promise<StoredSessionBundle> {
  await expect
    .poll(async () => {
      const bundle = await readStoredSession(page)
      return bundle?.refreshToken ? 'present' : 'missing'
    })
    .toBe('present')
  const bundle = await readStoredSession(page)
  expect(bundle?.accessToken).toBeTruthy()
  expect(bundle?.refreshToken).toBeTruthy()
  expect(bundle?.sessionId).toBeTruthy()
  return bundle!
}

async function expectNoStoredSession(page: Page) {
  await expect
    .poll(async () => page.evaluate(key => window.localStorage.getItem(key), sessionBundleKey))
    .toBeNull()
}

async function expectAuthenticatedHome(page: Page, account: TestAccount) {
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByLabel('Create a post').or(page.getByText('This feed is quiet.')).first(),
  ).toBeVisible({timeout: 15_000})

  const bundle = await expectStoredSession(page)
  const me = await page.request.get(apiURL('/v1/accounts/me'), {
    headers: {authorization: `Bearer ${bundle.accessToken}`},
  })
  expect(me.status()).toBe(200)
  const envelope = (await me.json()) as ApiEnvelope<{primaryHandle: string}>
  expect(envelope.ok).toBe(true)
  if (envelope.ok) expect(envelope.data.primaryHandle).toBe(account.handle)
}

async function fillPasswordForm(page: Page, account: TestAccount, password = account.password) {
  await page.goto('/sign-in', {waitUntil: 'networkidle'})
  await page.getByTestId('sign-in-email').fill(account.email)
  await page.getByTestId('sign-in-password').fill(password)
}

async function passwordLogin(page: Page, account: TestAccount) {
  await fillPasswordForm(page, account)
  const sessionResponse = page.waitForResponse(matchesApiResponse('/v1/sessions', 'POST'))
  const meResponse = page.waitForResponse(matchesApiResponse('/v1/accounts/me', 'GET'))
  await page.getByTestId('sign-in-submit').click()
  expect((await sessionResponse).status()).toBe(200)
  expect((await meResponse).status()).toBe(200)
  await expectAuthenticatedHome(page, account)
}

async function reloadAndExpectRestored(page: Page, account: TestAccount) {
  const refreshResponse = page.waitForResponse(matchesApiResponse('/v1/sessions/refresh', 'POST'))
  const meResponse = page.waitForResponse(matchesApiResponse('/v1/accounts/me', 'GET'))
  await page.reload({waitUntil: 'networkidle'})
  expect((await refreshResponse).status()).toBe(200)
  expect((await meResponse).status()).toBe(200)
  await expectAuthenticatedHome(page, account)
}

async function coldRestoreAndExpectHome(browser: Browser, page: Page, account: TestAccount) {
  const storageState = await page.context().storageState()
  const context = await browser.newContext({
    baseURL: page.url(),
    storageState,
  })
  const restoredPage = await context.newPage()
  const events = collectCriticalEvents(restoredPage)
  try {
    const refreshResponse = restoredPage.waitForResponse(matchesApiResponse('/v1/sessions/refresh', 'POST'))
    const meResponse = restoredPage.waitForResponse(matchesApiResponse('/v1/accounts/me', 'GET'))
    await restoredPage.goto('/', {waitUntil: 'networkidle'})
    expect((await refreshResponse).status()).toBe(200)
    expect((await meResponse).status()).toBe(200)
    await expectAuthenticatedHome(restoredPage, account)
    expectNoCriticalEvents(events)
  } finally {
    await context.close()
  }
}

async function logoutFromDrawer(page: Page) {
  await activateByKeyboard(page, 'home-open-drawer')
  await expect(page.getByTestId('drawer-sign-out')).toBeVisible()
  const logoutResponse = page.waitForResponse(matchesApiResponse('/v1/sessions/current', 'DELETE'))
  await page.getByTestId('drawer-sign-out').click()
  expect((await logoutResponse).status()).toBe(200)
  await expect(page).toHaveURL(/\/welcome$/)
  await expectNoStoredSession(page)
}

async function activateByKeyboard(page: Page, testId: string) {
  await page.getByTestId(testId).focus()
  await page.keyboard.press('Enter')
}

async function requestEmailCode(page: Page, account: TestAccount) {
  await page.goto('/sign-in', {waitUntil: 'networkidle'})
  await page.getByTestId('sign-in-email').fill(account.email)
  const requestResponse = page.waitForResponse(matchesApiResponse('/v1/sessions/email-code/request', 'POST'))
  await page.getByTestId('sign-in-email-code-request').click()
  expect((await requestResponse).status()).toBe(200)
  await expect(page.getByTestId('sign-in-email-code')).toBeVisible()
}

async function registerThroughBrowser(page: Page, prefix: string) {
  const account = createAccountInput(prefix)
  await page.goto('/register', {waitUntil: 'networkidle'})
  await expect(page.getByTestId('create-account-email')).toBeVisible({timeout: 15_000})

  await page.getByTestId('create-account-display-name').fill(`Phase 7L ${prefix} User`)
  await page.getByTestId('create-account-email').fill(account.email)
  await page.getByTestId('create-account-email-continue').click()

  await page.getByTestId('create-account-password').fill(account.password)
  await page.getByTestId('create-account-password-confirmation').fill(account.password)
  await page.getByTestId('create-account-password-continue').click()

  await page.getByTestId('create-account-handle').fill(account.handle)
  const availabilityResponse = page.waitForResponse(
    matchesApiResponse(`/v1/accounts/handles/${encodeURIComponent(account.handle)}/availability`, 'GET'),
  )
  await page.getByTestId('create-account-handle-continue').click()
  expect((await availabilityResponse).status()).toBe(200)

  await page.getByTestId('create-account-terms').click()
  await page.getByTestId('create-account-privacy').click()
  const registerResponse = page.waitForResponse(matchesApiResponse('/v1/accounts/register', 'POST'))
  await page.getByTestId('create-account-submit').click()
  const registered = await registerResponse
  expect(registered.status()).toBe(201)
  const envelope = (await registered.json()) as ApiEnvelope<RegisterResult>
  expect(envelope.ok).toBe(true)
  if (!envelope.ok) throw new Error(envelope.error.message)

  await expect(page).toHaveURL(/\/verify-email/)
  await expect(page.getByTestId('verify-email-code')).toBeVisible()
  return {
    account: {
      ...account,
      accountId: envelope.data.accountId,
      handle: envelope.data.primaryHandle,
    },
    verificationChallengeId: envelope.data.verificationChallengeId,
  }
}

function wrongCodeFor(code: string) {
  return code === '000000' ? '000001' : '000000'
}

test('password login reaches Home, survives reload, logs out, and re-login works', async ({page}) => {
  const events = collectCriticalEvents(page)
  const account = await createVerifiedAccount('password')

  await passwordLogin(page, account)
  await reloadAndExpectRestored(page, account)
  await logoutFromDrawer(page)

  await page.goto('/settings/account', {waitUntil: 'networkidle'})
  await expect(page.getByText('Sign in to manage your Modula Account.')).toBeVisible()
  await expectNoStoredSession(page)

  await passwordLogin(page, account)
  expectNoCriticalEvents(events)
})

test('password login survives cold browser restore while valid', async ({browser, page}) => {
  const events = collectCriticalEvents(page)
  const account = await createVerifiedAccount('cold')

  await passwordLogin(page, account)
  await reloadAndExpectRestored(page, account)
  await coldRestoreAndExpectHome(browser, page, account)
  expectNoCriticalEvents(events)
})

test('email OTP login reaches Home and survives reload', async ({page}) => {
  const events = collectCriticalEvents(page)
  const account = await createVerifiedAccount('otp')

  await requestEmailCode(page, account)
  const code = await latestMailCode(account.accountId, 'passwordless-login')
  const otpResponse = page.waitForResponse(matchesApiResponse('/v1/sessions/email-code', 'POST'))
  const meResponse = page.waitForResponse(matchesApiResponse('/v1/accounts/me', 'GET'))
  await page.getByTestId('sign-in-email-code').fill(code)
  await page.getByTestId('sign-in-email-code-submit').click()
  expect((await otpResponse).status()).toBe(200)
  expect((await meResponse).status()).toBe(200)
  await expectAuthenticatedHome(page, account)
  await reloadAndExpectRestored(page, account)
  expectNoCriticalEvents(events)
})

test('wrong password leaves no session and shows password-domain error', async ({page}) => {
  const events = collectCriticalEvents(page)
  const account = await createVerifiedAccount('badpass')

  await fillPasswordForm(page, account, `${account.password}-wrong`)
  const response = page.waitForResponse(matchesApiResponse('/v1/sessions', 'POST'))
  await page.getByTestId('sign-in-submit').click()
  const signIn = await response
  expect(signIn.status()).toBe(401)
  const envelope = (await signIn.json()) as ApiEnvelope<unknown>
  expect(envelope.ok).toBe(false)
  if (!envelope.ok) expect(envelope.error.code).toBe('INVALID_CREDENTIALS')
  await expect(page.getByText('Invalid credentials')).toBeVisible()
  await expect(page.getByText('That sign-in code is invalid or expired.')).toBeHidden()
  await expectNoStoredSession(page)
  expectNoCriticalEvents(events, [{status: 401, method: 'POST', path: '/v1/sessions'}])
})

test('wrong OTP leaves no session and shows OTP-domain error', async ({page}) => {
  const events = collectCriticalEvents(page)
  const account = await createVerifiedAccount('badotp')

  await requestEmailCode(page, account)
  const code = await latestMailCode(account.accountId, 'passwordless-login')
  const response = page.waitForResponse(matchesApiResponse('/v1/sessions/email-code', 'POST'))
  await page.getByTestId('sign-in-email-code').fill(wrongCodeFor(code))
  await page.getByTestId('sign-in-email-code-submit').click()
  const otp = await response
  expect(otp.status()).toBe(401)
  const envelope = (await otp.json()) as ApiEnvelope<unknown>
  expect(envelope.ok).toBe(false)
  if (!envelope.ok) expect(envelope.error.code).toBe('CHALLENGE_INVALID')
  await expect(page.getByText('That sign-in code is invalid or expired.')).toBeVisible()
  await expectNoStoredSession(page)
  expectNoCriticalEvents(events, [{status: 401, method: 'POST', path: '/v1/sessions/email-code'}])
})

test('email verification browser flow rejects wrong code, activates account, and then signs in', async ({page}) => {
  const events = collectCriticalEvents(page)
  const {account} = await registerThroughBrowser(page, 'verify')
  const code = await latestMailCode(account.accountId, 'verification-code')

  const wrongResponse = page.waitForResponse(matchesApiResponse('/v1/accounts/verify-email', 'POST'))
  await page.getByTestId('verify-email-code').fill(wrongCodeFor(code))
  await page.getByTestId('verify-email-submit').click()
  const wrongVerification = await wrongResponse
  expect(wrongVerification.status()).toBe(401)
  const wrongEnvelope = (await wrongVerification.json()) as ApiEnvelope<unknown>
  expect(wrongEnvelope.ok).toBe(false)
  if (!wrongEnvelope.ok) expect(wrongEnvelope.error.code).toBe('CHALLENGE_INVALID')
  await expect(page.getByText('That verification code is invalid or expired.')).toBeVisible()
  await expectNoStoredSession(page)

  const verifyResponse = page.waitForResponse(matchesApiResponse('/v1/accounts/verify-email', 'POST'))
  await page.getByTestId('verify-email-code').fill(code)
  await page.getByTestId('verify-email-submit').click()
  const verified = await verifyResponse
  expect(verified.status()).toBe(200)
  await expect(page).toHaveURL(/\/sign-in/)
  await expectNoStoredSession(page)

  await passwordLogin(page, account)
  await reloadAndExpectRestored(page, account)
  expectNoCriticalEvents(events, [{status: 401, method: 'POST', path: '/v1/accounts/verify-email'}])
})

test('password reset browser flow revokes old session and accepts only the new password', async ({page}) => {
  const events = collectCriticalEvents(page)
  const account = await createVerifiedAccount('reset')
  const nextPassword = `${account.password}-next`
  const login = await apiJson<SessionTokenResult>('/v1/sessions', {
    method: 'POST',
    body: JSON.stringify({
      email: account.email,
      password: account.password,
    }),
  })
  expect(login.response.status).toBe(200)
  if (!login.body.ok) throw new Error(login.body.error.message)
  const oldAccessToken = login.body.data.accessToken

  await page.goto('/forgot-password', {waitUntil: 'networkidle'})
  await page.getByTestId('forgot-password-email').fill(account.email)
  const forgotResponse = page.waitForResponse(matchesApiResponse('/v1/accounts/forgot-password', 'POST'))
  await page.getByTestId('forgot-password-submit').click()
  const forgot = await forgotResponse
  expect(forgot.status()).toBe(200)
  const recovery = (await forgot.json()) as ApiEnvelope<RecoveryResult>
  expect(recovery.ok).toBe(true)
  if (!recovery.ok || !recovery.data.recoveryToken) {
    throw new Error('Disposable auth verifier requires non-production recovery token exposure.')
  }
  await expect(page.getByText(/reset instructions were accepted/i)).toBeVisible()

  await page.getByTestId('forgot-password-have-code').click()
  await expect(page).toHaveURL(/\/reset-password/)
  await page.getByTestId('reset-password-code').fill(recovery.data.recoveryToken)
  await page.getByTestId('reset-password-new-password').fill(nextPassword)
  await page.getByTestId('reset-password-confirm-password').fill(nextPassword)
  const resetResponse = page.waitForResponse(matchesApiResponse('/v1/accounts/reset-password', 'POST'))
  await page.getByTestId('reset-password-submit').click()
  const reset = await resetResponse
  expect(reset.status()).toBe(200)
  await expect(page.getByText('Password updated. Sign in with your new password.')).toBeVisible()

  const revoked = await page.request.get(apiURL('/v1/accounts/me'), {
    headers: {authorization: `Bearer ${oldAccessToken}`},
  })
  expect(revoked.status()).toBe(401)

  await fillPasswordForm(page, account, account.password)
  const oldLoginResponse = page.waitForResponse(matchesApiResponse('/v1/sessions', 'POST'))
  await page.getByTestId('sign-in-submit').click()
  const oldLogin = await oldLoginResponse
  expect(oldLogin.status()).toBe(401)
  const oldLoginEnvelope = (await oldLogin.json()) as ApiEnvelope<unknown>
  expect(oldLoginEnvelope.ok).toBe(false)
  if (!oldLoginEnvelope.ok) expect(oldLoginEnvelope.error.code).toBe('INVALID_CREDENTIALS')
  await expect(page.getByText('Invalid credentials')).toBeVisible()
  await expectNoStoredSession(page)

  await passwordLogin(page, {...account, password: nextPassword})
  expectNoCriticalEvents(events, [{status: 401, method: 'POST', path: '/v1/sessions'}])
})

test('universal search uses real API results, pagination, recent, saved, reload, and empty state', async ({page}) => {
  const events = collectCriticalEvents(page)
  const account = await createVerifiedAccount('search')
  const fixture = seedUniversalSearchDocuments(account)

  await passwordLogin(page, account)
  await gotoProtectedRoute(page, '/product/search')
  await expect(page.getByTestId('universal-search-input')).toBeVisible()

  const searchResponse = page.waitForResponse(matchesSearchQueryResponse(fixture.query))
  await page.getByTestId('universal-search-input').fill(fixture.query)
  expect((await searchResponse).status()).toBe(200)
  await expect(page.getByText(fixture.profileTitle)).toBeVisible()
  await expect(page.getByText(fixture.firstPostTitle)).toBeVisible()
  await expect(page.getByText(fixture.moduleTitle)).toBeVisible()
  await expect(page.getByTestId('universal-search-result')).toHaveCount(6)
  await expectNoFallbackGlyphText(page)

  const nextPageResponse = page.waitForResponse(response => {
    const url = new URL(response.url())
    return matchesSearchQueryResponse(fixture.query)(response) && Boolean(url.searchParams.get('cursor'))
  })
  await page.getByLabel('Load more search results').click()
  expect((await nextPageResponse).status()).toBe(200)
  await expect(page.getByTestId('universal-search-result')).toHaveCount(7)

  const saveResponse = page.waitForResponse(matchesApiResponse('/v1/search/saved', 'POST'))
  await page.getByLabel('Save current search').click()
  expect((await saveResponse).status()).toBe(201)

  await page.getByTestId('universal-search-input').fill('')
  await expect(page.getByTestId('universal-search-library')).toBeVisible()
  await expect(page.getByLabel(`Run search ${fixture.query}`).first()).toBeVisible()

  await page.reload({waitUntil: 'networkidle'})
  await expect(page.getByTestId('universal-search-library')).toBeVisible()
  await expect(page.getByLabel(`Run search ${fixture.query}`).first()).toBeVisible()

  const replayResponse = page.waitForResponse(matchesSearchQueryResponse(fixture.query))
  await page.getByLabel(`Run search ${fixture.query}`).first().click()
  expect((await replayResponse).status()).toBe(200)
  await expect(page.getByTestId('universal-search-result')).toHaveCount(6)

  const emptyQuery = `nomatches${account.handle}`
  const emptyResponse = page.waitForResponse(matchesSearchQueryResponse(emptyQuery))
  await page.getByTestId('universal-search-input').fill(emptyQuery)
  expect((await emptyResponse).status()).toBe(200)
  await expect(page.getByTestId('universal-search-empty')).toBeVisible()

  expectNoCriticalEvents(events)
})

test('profile owner, edit persistence, reload, and public viewer route use Greenfield state', async ({page}) => {
  const events = collectCriticalEvents(page)
  const owner = await createVerifiedAccount('profile')
  const viewer = await createVerifiedAccount('viewer')
  const nextHandle = `${owner.handle}x`
  const nextDisplayName = `Phase 7L Profile ${owner.handle}`
  const nextBio = `Persistent profile proof ${owner.handle}`
  const nextLocation = `London ${owner.handle.slice(-4)}`
  const nextWebsite = `https://example.com/${owner.handle}`

  await passwordLogin(page, owner)
  await gotoProtectedRoute(page, '/profile')
  await expect(page.getByText(`@${owner.handle}`).first()).toBeVisible()
  await expect(page.getByText('Posts').first()).toBeVisible()
  await expect(page.getByText('Media').first()).toBeVisible()
  await expect(page.getByText('About').first()).toBeVisible()
  await expect(page.getByText('Modules').first()).toBeVisible()
  await expect(page.getByText('Links').first()).toBeVisible()
  await expect(page.getByLabel(/Focus status:/).first()).toBeVisible()

  await page.goto('/profile/edit', {waitUntil: 'networkidle'})
  await expect(page.getByTestId('edit-profile-display-name')).toBeVisible()
  await page.getByTestId('edit-profile-display-name').fill(nextDisplayName)
  await page.getByTestId('edit-profile-handle').fill(nextHandle)
  await page.getByTestId('edit-profile-bio').fill(nextBio)
  await page.getByTestId('edit-profile-location').fill(nextLocation)
  await page.getByTestId('edit-profile-website').fill(nextWebsite)
  await page.getByLabel('Set focus status to Busy').click()

  const saveResponse = page.waitForResponse(matchesApiResponse('/v1/profiles/me', 'PATCH'))
  await page.getByLabel('Save').click()
  const saved = await saveResponse
  expect(saved.status()).toBe(200)
  const savedEnvelope = (await saved.json()) as ApiEnvelope<{handle: string; displayName: string; bio: string}>
  expect(savedEnvelope.ok).toBe(true)
  if (savedEnvelope.ok) {
    expect(savedEnvelope.data.handle).toBe(nextHandle)
    expect(savedEnvelope.data.displayName).toBe(nextDisplayName)
    expect(savedEnvelope.data.bio).toBe(nextBio)
  }

  await expect(page.getByText(nextDisplayName).first()).toBeVisible()
  await expect(page.getByText(`@${nextHandle}`).first()).toBeVisible()
  await expect(page.getByText(nextBio).first()).toBeVisible()
  await expect(page.getByText(nextLocation).first()).toBeVisible()
  await expect(page.getByText('example.com').first()).toBeVisible()
  await expect(page.getByLabel(`${nextDisplayName}, Busy. Focus status: Busy`).first()).toBeVisible()

  const refreshResponse = page.waitForResponse(matchesApiResponse('/v1/sessions/refresh', 'POST'))
  const meResponse = page.waitForResponse(matchesApiResponse('/v1/accounts/me', 'GET'))
  await page.reload({waitUntil: 'networkidle'})
  expect((await refreshResponse).status()).toBe(200)
  expect((await meResponse).status()).toBe(200)
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByText(nextDisplayName).first()).toBeVisible()
  await expect(page.getByText(`@${nextHandle}`).first()).toBeVisible()
  await expect(page.getByText(nextBio).first()).toBeVisible()

  await page.goto('/', {waitUntil: 'networkidle'})
  await logoutFromDrawer(page)
  await passwordLogin(page, viewer)
  await gotoProtectedRoute(page, `/profile/${nextHandle}`)
  await expect(page.getByText(nextDisplayName).first()).toBeVisible()
  await expect(page.getByText(`@${nextHandle}`).first()).toBeVisible()
  await expect(page.getByText(nextBio).first()).toBeVisible()
  await expect(page.getByText(nextLocation).first()).toBeVisible()
  await expect(page.getByText('example.com').first()).toBeVisible()
  await expect(page.getByText('Edit Profile')).toBeHidden()
  await expect(page.getByText(`Follow ${nextDisplayName}`).or(page.getByText('Follow')).first()).toBeVisible()

  expectNoCriticalEvents(events)
})

test('composer poll and GIF controls are Coming Soon and do not fake a draft attachment', async ({page}) => {
  const events = collectCriticalEvents(page)
  const account = await createVerifiedAccount('composer')
  await passwordLogin(page, account)
  await gotoProtectedRoute(page, '/compose')
  await expect(page.getByLabel('GIF — Coming Soon')).toBeVisible()
  await expect(page.getByLabel('Poll — Coming Soon')).toBeVisible()

  page.once('dialog', async dialog => {
    expect(dialog.message()).toMatch(/Coming Soon|not part of beta Composer/i)
    await dialog.accept()
  })
  await page.getByLabel('GIF — Coming Soon').click()
  await expect(page.getByText('Which Modula surface should be refined next?')).toHaveCount(0)
  await expect(page.getByText('Board')).toHaveCount(0)

  page.once('dialog', async dialog => {
    expect(dialog.message()).toMatch(/Coming Soon|Polls are not part of beta Composer/i)
    await dialog.accept()
  })
  await page.getByLabel('Poll — Coming Soon').click()
  await expect(page.getByText('Which Modula surface should be refined next?')).toHaveCount(0)

  expectNoCriticalEvents(events)
})

test('settings expose honest mail, sessions, and Coming Soon security controls', async ({page}) => {
  const events = collectCriticalEvents(page)
  const account = await createVerifiedAccount('security')
  await passwordLogin(page, account)

  await gotoProtectedRoute(page, '/settings/security')
  await expect(page.getByLabel('Passkeys — Coming Soon')).toBeVisible()
  await expect(page.getByLabel('Authenticator app (TOTP) — Coming Soon')).toBeVisible()
  await expect(page.getByLabel('Recovery codes — Coming Soon')).toBeVisible()
  await page.getByLabel('Passkeys — Coming Soon').click()
  await expect(page).toHaveURL(/\/settings\/security/)

  const sessionsResponse = page.waitForResponse(matchesApiResponse('/v1/accounts/me/sessions', 'GET'))
  await gotoProtectedRoute(page, '/settings/account/sessions')
  expect((await sessionsResponse).status()).toBe(200)
  await expect(page.getByTestId('account-session-row').first()).toBeVisible()
  await expect(page.getByText('No additional sessions listed.')).toHaveCount(0)

  const mailResponse = page.waitForResponse(matchesApiResponse('/v1/accounts/me/modula-mail', 'GET'))
  await gotoProtectedRoute(page, '/settings/account/mail')
  expect((await mailResponse).status()).toBe(200)
  await expect(page.getByTestId('modula-mail-state')).toBeVisible()
  await expect(page.getByText('No Modula mailbox').or(page.getByText('Mailbox not active')).or(page.getByText('Mailbox not live')).first()).toBeVisible()
  await expect(page.getByText(/live inbox|active inbox/i).first()).toBeVisible()
  await expect(page.getByText('Your mailbox is active')).toHaveCount(0)

  expectNoCriticalEvents(events)
})

test('authenticated Home, Activity, Profile, Product Hub, and Settings render cleanly', async ({page}) => {
  const events = collectCriticalEvents(page)
  const assetResponses = collectAssetResponses(page)
  const account = await createVerifiedAccount('routes')

  await passwordLogin(page, account)
  await expectIoniconsReady(page)
  await expectNoFallbackGlyphText(page)

  await reloadAndExpectRestored(page, account)
  await expectIoniconsReady(page)
  await expectNoFallbackGlyphText(page)

  await gotoProtectedRoute(page, '/activity')
  await expect(page.getByText('No activity yet').or(page.getByText('Today')).first()).toBeVisible()
  await expectIoniconsReady(page)
  await expectNoFallbackGlyphText(page)

  await gotoProtectedRoute(page, '/profile')
  await expect(page.getByText(`@${account.handle}`).first()).toBeVisible({timeout: 15_000})
  await expect(page.getByText('Posts').first()).toBeVisible()
  await expectIoniconsReady(page)
  await expectNoFallbackGlyphText(page)

  await gotoProtectedRoute(page, '/marketplace')
  await expect(page.getByText('Product Hub').first()).toBeVisible()
  await expect(page.getByLabel('Search Product Hub')).toBeVisible()
  await expectIoniconsReady(page)
  await expectNoFallbackGlyphText(page)

  await gotoProtectedRoute(page, '/settings')
  await expect(page.getByText('Settings').first()).toBeVisible()
  await expect(page.getByText('Account').first()).toBeVisible()
  await expect(page.getByText('Security').first()).toBeVisible()
  await expect(page.getByText('Appearance').first()).toBeVisible()
  await expectIoniconsReady(page)
  await expectNoFallbackGlyphText(page)

  expectStaticAssetResponsesHealthy(assetResponses)
  expectNoCriticalEvents(events)
})
