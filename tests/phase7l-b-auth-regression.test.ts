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
    events.push({type: 'pageerror', text: error.message})
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
