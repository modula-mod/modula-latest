#!/usr/bin/env node
/**
 * Phase 7F-B acceptance seed helper (scripts-only — never import from frontend).
 *
 * Local data source:
 *   Seeding happens through LocalApi after the app starts (in-process). This script
 *   does not mutate LocalApi state; start the app with EXPO_PUBLIC_DATA_SOURCE=local
 *   and use LocalApi / developer tools to create accounts and posts.
 *
 * Remote API (optional):
 *   When API_URL (or EXPO_PUBLIC_API_URL) is set and environment is non-production,
 *   this script can POST register → login → create posts via fetch. Idempotent-ish:
 *   register conflicts fall through to login; duplicate posts are tolerated.
 *
 * Safety:
 *   Refuses NODE_ENV=production or EXPO_PUBLIC_APP_ENV=production.
 */
import {randomBytes} from 'node:crypto'

const nodeEnv = process.env.NODE_ENV ?? ''
const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? process.env.MODULA_ENVIRONMENT ?? ''

function die(message) {
  console.error(`seed-phase7f-b-acceptance: ${message}`)
  process.exit(1)
}

if (nodeEnv === 'production' || appEnv === 'production') {
  die('refusing to seed against production (NODE_ENV or EXPO_PUBLIC_APP_ENV=production)')
}

const apiUrl = (process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '')
const dataSource = process.env.EXPO_PUBLIC_DATA_SOURCE || 'local'

function printLocalInstructions() {
  console.log(`
Phase 7F-B acceptance seed — local mode
---------------------------------------
EXPO_PUBLIC_DATA_SOURCE=${dataSource || 'local'}

For the local data source, seeding is done through LocalApi after the app starts:
  1. Start the app with EXPO_PUBLIC_DATA_SOURCE=local (and non-production APP_ENV).
  2. Use LocalApi / in-app developer session tools to register or bootstrap a session.
  3. Create posts/stories via the product UI or LocalApi routes — not this script.

This script never imports into the frontend and will not mutate LocalApi state here.

Optional remote seed:
  API_URL=http://127.0.0.1:8787 EXPO_PUBLIC_APP_ENV=development \\
    node scripts/seed-phase7f-b-acceptance.mjs
`)
}

async function api(method, path, body, token) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = {raw: text}
  }
  return {ok: response.ok, status: response.status, json}
}

async function seedRemote() {
  const suffix = randomBytes(3).toString('hex')
  const email = process.env.SEED_EMAIL || `phase7fb.acceptance.${suffix}@example.invalid`
  const password = process.env.SEED_PASSWORD || `Phase7fB-${suffix}-Accept!`
  const handle = process.env.SEED_HANDLE || `phase7fb${suffix}`
  const displayName = process.env.SEED_DISPLAY_NAME || 'Phase 7F-B Acceptance'
  const inviteCode = process.env.SEED_INVITE_CODE || process.env.MODULA_REGISTRATION_INVITE_CODES?.split(',')[0]

  console.log(`Seeding remote API at ${apiUrl} (non-production)`)
  console.log(`Account: ${email} / handle=${handle}`)

  const registerBody = {
    email,
    password,
    handle,
    displayName,
    acceptedTerms: true,
  }
  if (inviteCode) registerBody.inviteCode = inviteCode

  const registered = await api('POST', '/v1/accounts/register', registerBody)
  if (registered.ok) {
    console.log(`PASS register (${registered.status})`)
  } else if (registered.status === 409 || registered.status === 400) {
    console.log(`INFO register skipped (${registered.status}) — will try login (idempotent-ish)`)
  } else {
    die(`register failed ${registered.status}: ${JSON.stringify(registered.json)}`)
  }

  const login = await api('POST', '/v1/sessions', {email, password})
  if (!login.ok) {
    die(`login failed ${login.status}: ${JSON.stringify(login.json)}`)
  }
  const accessToken =
    login.json?.data?.accessToken ??
    login.json?.data?.tokens?.accessToken ??
    login.json?.accessToken
  if (!accessToken) {
    die(`login response missing accessToken: ${JSON.stringify(login.json)}`)
  }
  console.log('PASS login')

  const postBodies = [
    {text: 'Phase 7F-B acceptance post — home feed'},
    {text: 'Phase 7F-B acceptance post — browse'},
  ]
  for (const body of postBodies) {
    const created = await api('POST', '/v1/posts', body, accessToken)
    if (created.ok || created.status === 409) {
      console.log(`PASS create post (${created.status})`)
    } else {
      console.warn(`WARN create post failed ${created.status}: ${JSON.stringify(created.json)}`)
    }
  }

  console.log('Phase 7F-B remote acceptance seed finished.')
}

if (!apiUrl) {
  printLocalInstructions()
  process.exit(0)
}

if (/modula\.(app|social)|production/i.test(apiUrl) && !process.env.SEED_ALLOW_REMOTE) {
  die(`refusing suspicious API_URL without SEED_ALLOW_REMOTE=1: ${apiUrl}`)
}

seedRemote().catch(error => {
  die(error instanceof Error ? error.message : String(error))
})
