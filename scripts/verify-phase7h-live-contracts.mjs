#!/usr/bin/env node

const apiOrigin = (process.env.MODULA_LIVE_API_ORIGIN ?? 'https://api.modula.digital').replace(/\/+$/, '')
const errors = []

const live = await requestJson('/v1/health/live')
if (!live.ok || live.status !== 200 || live.body?.ok !== true) {
  errors.push(`/v1/health/live failed: HTTP ${live.status}`)
}

const ready = await requestJson('/v1/health/ready')
if (!ready.ok || ready.status !== 200 || ready.body?.ok !== true) {
  errors.push(`/v1/health/ready failed: HTTP ${ready.status}`)
}

const meta = await requestJson('/v1/meta')
if (!meta.ok || meta.status !== 200 || meta.body?.ok !== true) {
  errors.push(`/v1/meta failed: HTTP ${meta.status}`)
} else {
  const data = meta.body.data ?? {}
  const registration = data.registration
  if (!registration || typeof registration !== 'object') {
    errors.push('/v1/meta deployed schema stale: missing data.registration')
  } else {
    if (registration.mode !== 'open') {
      errors.push(`/v1/meta registration mode is ${JSON.stringify(registration.mode)}, expected "open"`)
    }
    if (registration.emailVerificationRequired !== true) {
      errors.push('/v1/meta registration.emailVerificationRequired is not true')
    }
  }

  if (data.capabilities?.inviteOnly === true && !registration) {
    errors.push('/v1/meta deployed schema stale: legacy inviteOnly capability present without registration contract')
  }
}

const stories = await requestText('/v1/stories/rail')
if (stories.status === 404 && /Route GET:\/v1\/stories\/rail not found/i.test(stories.text)) {
  errors.push('/v1/stories/rail route absent: deployed API returned route-not-found 404')
} else if (![200, 401, 403].includes(stories.status)) {
  errors.push(`/v1/stories/rail returned unexpected HTTP ${stories.status}; expected 200, 401, or 403`)
}

if (errors.length) {
  console.error('Phase 7H live contract verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Phase 7H live contracts passed against ${apiOrigin}.`)

async function requestJson(path) {
  const response = await fetch(`${apiOrigin}${path}`, {
    headers: {accept: 'application/json'},
    cache: 'no-store',
  })
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    return {ok: false, status: response.status, body: null, text}
  }
  return {ok: response.ok, status: response.status, body, text}
}

async function requestText(path) {
  const response = await fetch(`${apiOrigin}${path}`, {
    headers: {accept: 'application/json'},
    cache: 'no-store',
  })
  return {ok: response.ok, status: response.status, text: await response.text()}
}
