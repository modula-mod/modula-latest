#!/usr/bin/env node
import {createHash, randomUUID} from 'node:crypto'
import {mkdirSync, writeFileSync} from 'node:fs'
import {dirname} from 'node:path'

const baseUrl = (process.env.API_ATLAS_BASE_URL ?? 'https://api.modula.digital').replace(/\/$/, '')
const outputPath = process.env.API_ATLAS_EVIDENCE_PATH ?? '/var/lib/modula/api-atlas/authenticated-acceptance.json'
const marker = `API-BASELINE-02:${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}:${randomUUID()}`
const fixtures = {posts: [], comments: [], attachments: [], records: [], follows: [], preferences: []}
const checks = []
const cleanup = []

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required; load the protected API Atlas environment file`)
  return value
}

function digest(value) {
  return value ? createHash('sha256').update(String(value)).digest('hex').slice(0, 12) : null
}

async function call(method, path, {token, body, binary} = {}) {
  const headers = {'cache-control': 'no-store'}
  if (token) headers.authorization = `Bearer ${token}`
  if (binary) headers['content-type'] = 'application/octet-stream'
  else if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: binary ?? (body === undefined ? undefined : JSON.stringify(body)),
  })
  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('json') ? await response.json() : null
  return {status: response.status, payload}
}

function record(name, result, acceptedStatuses, acceptedCodes = []) {
  const errorCode = result.payload?.error?.code ?? null
  const ok = acceptedStatuses.includes(result.status) && (!acceptedCodes.length || acceptedCodes.includes(errorCode))
  checks.push({name, status: result.status, errorCode, result: ok ? 'PASS' : 'FAIL'})
  if (!ok) throw new Error(`${name}: expected ${acceptedStatuses.join('/')} ${acceptedCodes.join('/')}, got ${result.status} ${errorCode ?? ''}`)
  return result
}

function recordAssertion(name, ok) {
  checks.push({name, status: null, errorCode: ok ? null : 'ASSERTION_FAILED', result: ok ? 'PASS' : 'FAIL'})
  if (!ok) throw new Error(`${name}: assertion failed`)
}

function cleanupResult(resource, key, result, acceptedStatuses, verificationStatus = null, acceptedVerificationStatuses = []) {
  const ok = acceptedStatuses.includes(result.status) && (
    verificationStatus === null || acceptedVerificationStatuses.includes(verificationStatus)
  )
  cleanup.push({resource, key, status: result.status, verificationStatus, result: ok ? 'PASS' : 'FAIL'})
}

async function login(email, password) {
  const response = await call('POST', '/v1/sessions', {body: {email, password, clientName: 'API Atlas acceptance', platform: 'server'}})
  record('audit identity login', response, [200])
  return {token: response.payload.data.accessToken, sessionId: response.payload.data.sessionId}
}

async function main() {
  const passwordA = required('API_ATLAS_A_PASSWORD')
  const passwordB = required('API_ATLAS_B_PASSWORD')
  const a = await login(process.env.API_ATLAS_A_EMAIL ?? 'api-atlas-a@audit.invalid', passwordA)
  const b = await login(process.env.API_ATLAS_B_EMAIL ?? 'api-atlas-b@audit.invalid', passwordB)
  const meA = record('account A self read', await call('GET', '/v1/accounts/me', {token: a.token}), [200]).payload.data
  const meB = record('account B self read', await call('GET', '/v1/accounts/me', {token: b.token}), [200]).payload.data
  if (meA.primaryHandle !== 'api-atlas-a' || meB.primaryHandle !== 'api-atlas-b') throw new Error('Reserved audit handles do not match')
  const actorB = `actor-${meB.accountId}`

  let profileB
  try {
    profileB = record('profile B owner read', await call('GET', '/v1/profiles/api-atlas-b', {token: b.token}), [200]).payload.data
    record('profile B follower-only setup', await call('PATCH', '/v1/profiles/me', {token: b.token, body: {visibility: 'followers', expectedVersion: profileB.version}}), [200])
    profileB = (await call('GET', '/v1/profiles/api-atlas-b', {token: b.token})).payload.data

    const priorRecords = await call('GET', '/v1/repositories/me/records?collection=modula.api-atlas.fixture', {token: b.token})
    if (priorRecords.status === 200) {
      const items = Array.isArray(priorRecords.payload?.data) ? priorRecords.payload.data : priorRecords.payload?.data?.items ?? []
      for (const item of items) {
        if (typeof item?.data?.auditMarker !== 'string' || !item.data.auditMarker.startsWith('API-BASELINE-02:')) continue
        const result = await call('DELETE', `/v1/repositories/me/records/${item.record_id}`, {token: b.token, body: {expectedRevision: Number(item.revision)}})
        cleanupResult('recovered-record', digest(item.record_id), result, [200])
      }
    }

    const originalPreferencesA = record('settings v2 A preferences read', await call('GET', '/v1/accounts/me/app-preferences', {token: a.token}), [200]).payload.data
    const originalPreferencesB = record('settings v2 B preferences read', await call('GET', '/v1/accounts/me/app-preferences', {token: b.token}), [200]).payload.data
    fixtures.preferences.push({key: 'api-atlas-a', token: a.token, preferences: originalPreferencesA.preferences})
    fixtures.preferences.push({key: 'api-atlas-b', token: b.token, preferences: originalPreferencesB.preferences})

    const modeA = 'modules'
    const modeB = 'for-you'
    const updatedPreferencesA = record('settings v2 A preferences write', await call('PATCH', '/v1/accounts/me/app-preferences', {token: a.token, body: {preferences: {'feed.defaultMode': modeA, 'time.relative': !originalPreferencesA.preferences['time.relative']}}}), [200]).payload.data
    const updatedPreferencesB = record('settings v2 B preferences write', await call('PATCH', '/v1/accounts/me/app-preferences', {token: b.token, body: {preferences: {'feed.defaultMode': modeB, 'units.distance': originalPreferencesB.preferences['units.distance'] === 'metric' ? 'imperial' : 'metric'}}}), [200]).payload.data
    recordAssertion('settings v2 A write is account scoped', updatedPreferencesA.preferences['feed.defaultMode'] === modeA)
    recordAssertion('settings v2 B write is account scoped', updatedPreferencesB.preferences['feed.defaultMode'] === modeB)
    const persistedPreferencesA = record('settings v2 A preferences persistence', await call('GET', '/v1/accounts/me/app-preferences', {token: a.token}), [200]).payload.data
    const persistedPreferencesB = record('settings v2 B preferences persistence', await call('GET', '/v1/accounts/me/app-preferences', {token: b.token}), [200]).payload.data
    recordAssertion('settings v2 A persisted value', persistedPreferencesA.preferences['feed.defaultMode'] === modeA)
    recordAssertion('settings v2 B persisted value', persistedPreferencesB.preferences['feed.defaultMode'] === modeB)
    const injectedPreferences = record('settings v2 query identifier remains self scoped', await call('GET', `/v1/accounts/me/app-preferences?accountId=${encodeURIComponent(meB.accountId)}`, {token: a.token}), [200]).payload.data
    recordAssertion('settings v2 query identifier cannot read B', injectedPreferences.preferences['feed.defaultMode'] === modeA && injectedPreferences.preferences['feed.defaultMode'] !== modeB)
    record('settings v2 alternate account route absent', await call('GET', `/v1/accounts/${encodeURIComponent(meB.accountId)}/app-preferences`, {token: a.token}), [404])
    record('settings v2 body identifier rejected', await call('PATCH', '/v1/accounts/me/app-preferences', {token: a.token, body: {preferences: {'feed.defaultMode': 'following'}, accountId: meB.accountId}}), [400], ['VALIDATION_FAILED'])
    record('settings v2 unknown preference rejected', await call('PATCH', '/v1/accounts/me/app-preferences', {token: a.token, body: {'unknown.namespace': true}}), [400], ['VALIDATION_FAILED'])
    record('settings v2 nested namespace rejected', await call('PATCH', '/v1/accounts/me/app-preferences', {token: a.token, body: {feed: {defaultMode: 'following'}}}), [400], ['VALIDATION_FAILED'])
    record('settings v2 invalid enum rejected', await call('PATCH', '/v1/accounts/me/app-preferences', {token: a.token, body: {'feed.defaultMode': 'invalid'}}), [400], ['VALIDATION_FAILED'])
    record('settings v2 wrong type rejected', await call('PATCH', '/v1/accounts/me/app-preferences', {token: a.token, body: {'digests.weekly': 'yes'}}), [400], ['VALIDATION_FAILED'])
    record('settings v2 invalid time zone rejected', await call('PATCH', '/v1/accounts/me/app-preferences', {token: a.token, body: {'digests.timeZone': 'Mars/Olympus'}}), [400], ['VALIDATION_FAILED'])
    record('settings v2 empty patch rejected', await call('PATCH', '/v1/accounts/me/app-preferences', {token: a.token, body: {}}), [400], ['VALIDATION_FAILED'])
    record('settings v2 oversized payload rejected', await call('PATCH', '/v1/accounts/me/app-preferences', {token: a.token, body: {'feed.defaultMode': 'x'.repeat(2_000_000)}}), [413])

    for (const identity of [{label: 'A', token: a.token, password: passwordA}, {label: 'B', token: b.token, password: passwordB}]) {
      record(`settings v2 ${identity.label} mutes read`, await call('GET', '/v1/accounts/me/mutes', {token: identity.token}), [200])
      record(`settings v2 ${identity.label} blocks read`, await call('GET', '/v1/accounts/me/blocks', {token: identity.token}), [200])
      record(`settings v2 ${identity.label} insights read`, await call('GET', '/v1/creator/insights?days=7', {token: identity.token}), [200])
      record(`settings v2 ${identity.label} payouts read`, await call('GET', '/v1/creator/payouts', {token: identity.token}), [200])
      record(`settings v2 ${identity.label} invoices read`, await call('GET', '/v1/commerce/invoices', {token: identity.token}), [200])
      record(`settings v2 ${identity.label} password step-up`, await call('POST', '/v1/auth/step-up/password', {token: identity.token, body: {password: identity.password}}), [200])
      record(`settings v2 ${identity.label} deletion status read`, await call('GET', '/v1/account/deletion-requests/current', {token: identity.token}), [200])
    }
    record('settings v2 password target identifier rejected', await call('POST', '/v1/auth/step-up/password', {token: a.token, body: {password: passwordA, accountId: meB.accountId}}), [400], ['VALIDATION_FAILED'])

    const publicPost = record('write fixture B public post', await call('POST', '/v1/posts', {token: b.token, body: {text: `[${marker}] B public post`, audience: 'public', idempotencyKey: `${marker}:b-public`}}), [201]).payload.data
    fixtures.posts.push({id: publicPost.id, token: b.token, version: publicPost.version})
    const privatePost = record('write fixture B private post', await call('POST', '/v1/posts', {token: b.token, body: {text: `[${marker}] B private post`, audience: 'private', idempotencyKey: `${marker}:b-private`}}), [201]).payload.data
    fixtures.posts.push({id: privatePost.id, token: b.token, version: privatePost.version})
    const ownPost = record('write acceptance A post create', await call('POST', '/v1/posts', {token: a.token, body: {text: `[${marker}] A write acceptance`, audience: 'private', idempotencyKey: `${marker}:a-write`}}), [201]).payload.data
    fixtures.posts.push({id: ownPost.id, token: a.token, version: ownPost.version})

    const comment = record('write fixture B comment', await call('POST', `/v1/posts/${publicPost.id}/comments`, {token: b.token, body: {text: `[${marker}] B comment`}}), [201]).payload.data
    fixtures.comments.push({id: comment.comment_id, token: b.token, version: comment.version})

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    const upload = record('write fixture B attachment session', await call('POST', '/v1/attachments/uploads', {token: b.token, body: {filename: 'api-atlas.png', mimeType: 'image/png', size: png.length, metadata: {auditMarker: marker}}}), [201]).payload.data
    fixtures.attachments.push({id: upload.attachmentId, token: b.token})
    record('write fixture B attachment content', await call('PUT', `/v1/attachments/uploads/${upload.uploadId}/content`, {token: b.token, binary: png}), [200])

    const privateRecord = await call('POST', '/v1/repositories/me/records', {token: b.token, body: {collection: 'modula.api-atlas.fixture', schemaId: 'modula.extensions.tool', schemaVersion: 1, visibility: 'private', data: {name: 'API Atlas fixture', auditMarker: marker}}})
    if (privateRecord.status === 201) fixtures.records.push({id: privateRecord.payload.data.record_id, token: b.token, revision: Number(privateRecord.payload.data.revision)})
    record('write fixture B private record', privateRecord, [201])

    record('account handle history cross-user denial', await call('GET', `/v1/accounts/${meB.accountId}/handle-history`, {token: a.token}), [403], ['FORBIDDEN'])
    record('session cross-user revoke is owner-scoped', await call('DELETE', `/v1/sessions/${b.sessionId}`, {token: a.token}), [200])
    record('session B remains active after A revoke attempt', await call('GET', '/v1/accounts/me', {token: b.token}), [200])
    const accountPatch = record('account update remains self-scoped', await call('PATCH', '/v1/accounts/me', {token: a.token, body: {accountId: meB.accountId, auditMarker: marker}}), [200])
    if (accountPatch.payload.data.accountId !== meA.accountId) throw new Error('Account self-scope assertion failed')
    record('security sessions remain self-scoped', await call('GET', '/v1/accounts/me/sessions', {token: a.token}), [200])
    record('security passkeys remain self-scoped', await call('GET', '/v1/auth/passkeys', {token: a.token}), [200])

    record('private profile cross-user denial', await call('GET', '/v1/profiles/api-atlas-b', {token: a.token}), [404], ['NOT_FOUND'])
    record('profile update cross-user denial', await call('PATCH', '/v1/profiles/me', {token: a.token, body: {actorId: actorB, displayName: 'Cross User'}}), [403], ['FORBIDDEN'])
    record('avatar cross-user attachment denial', await call('POST', '/v1/profiles/me/avatar', {token: a.token, body: {attachmentId: upload.attachmentId}}), [403], ['FORBIDDEN'])
    record('cover cross-user attachment denial', await call('POST', '/v1/profiles/me/cover', {token: a.token, body: {attachmentId: upload.attachmentId}}), [403], ['FORBIDDEN'])

    record('private post identifier denial', await call('GET', `/v1/posts/${privatePost.id}`, {token: a.token}), [404], ['NOT_FOUND'])
    record('post cross-user edit denial', await call('PATCH', `/v1/posts/${publicPost.id}`, {token: a.token, body: {text: 'Cross User', expectedVersion: publicPost.version}}), [403], ['FORBIDDEN'])
    record('post cross-user delete denial', await call('DELETE', `/v1/posts/${publicPost.id}`, {token: a.token}), [403], ['FORBIDDEN'])
    record('post cross-user media bind denial', await call('POST', '/v1/posts', {token: a.token, body: {authorActorId: actorB, text: 'Cross User media bind', idempotencyKey: `${marker}:cross-media`, content: [{type: 'image', attachmentId: upload.attachmentId}]}}), [403], ['FORBIDDEN'])
    record('comment cross-user edit denial', await call('PATCH', `/v1/comments/${comment.comment_id}`, {token: a.token, body: {text: 'Cross User', expectedVersion: comment.version}}), [403], ['FORBIDDEN'])
    record('comment cross-user delete denial', await call('DELETE', `/v1/comments/${comment.comment_id}`, {token: a.token}), [403], ['FORBIDDEN'])

    record('attachment metadata cross-user denial', await call('GET', `/v1/attachments/${upload.attachmentId}`, {token: a.token}), [403], ['FORBIDDEN'])
    record('attachment content identifier denial', await call('GET', `/v1/attachments/${upload.attachmentId}/content`, {token: a.token}), [403], ['FORBIDDEN'])
    record('attachment delete cross-user denial', await call('DELETE', `/v1/attachments/${upload.attachmentId}`, {token: a.token}), [403], ['FORBIDDEN'])
    record('private repository record cross-user denial', await call('GET', `/v1/repositories/me/records/${privateRecord.payload.data.record_id}`, {token: a.token}), [404], ['NOT_FOUND'])
    record('private repository record mutation denial', await call('PATCH', `/v1/repositories/me/records/${privateRecord.payload.data.record_id}`, {token: a.token, body: {data: {auditMarker: marker, stolen: true}, expectedRevision: privateRecord.payload.data.revision}}), [404], ['NOT_FOUND'])

    const followerCountBefore = profileB.followerCount
    const follow = record('private follow creates pending request', await call('POST', `/v1/profiles/${profileB.id}/follow`, {token: a.token}), [200]).payload.data
    fixtures.follows.push({profileId: profileB.id, token: a.token})
    recordAssertion('pending follow grants no relationship', follow.relationship === 'pending' && follow.following === false && follow.pending === true && follow.isFollowing === false && typeof follow.requestId === 'string')
    const duplicateFollow = record('duplicate private follow stays pending', await call('POST', `/v1/profiles/${profileB.id}/follow`, {token: a.token}), [200]).payload.data
    recordAssertion('duplicate private follow reuses request', duplicateFollow.requestId === follow.requestId && duplicateFollow.following === false)
    record('pending private profile remains hidden', await call('GET', '/v1/profiles/api-atlas-b', {token: a.token}), [404], ['NOT_FOUND'])
    const pendingOwnerProfile = record('private profile owner read before approval', await call('GET', '/v1/profiles/api-atlas-b', {token: b.token}), [200]).payload.data
    recordAssertion('pending request does not increment followers', pendingOwnerProfile.followerCount === followerCountBefore)
    const incoming = record('private owner lists incoming requests', await call('GET', '/v1/profiles/me/follow-requests', {token: b.token}), [200]).payload.data
    recordAssertion('incoming list contains exact pending request', incoming.items.some(item => item.requestId === follow.requestId))
    record('requester cannot approve own request', await call('POST', `/v1/follow-requests/${follow.requestId}/accept`, {token: a.token}), [404], ['NOT_FOUND'])
    const accepted = record('private owner approves request', await call('POST', `/v1/follow-requests/${follow.requestId}/accept`, {token: b.token}), [200]).payload.data
    recordAssertion('approval establishes following relationship', accepted.relationship === 'following' && accepted.following === true && accepted.pending === false)
    record('private profile visible after explicit approval', await call('GET', '/v1/profiles/api-atlas-b', {token: a.token}), [200])
    const acceptedOwnerProfile = record('private profile owner read after approval', await call('GET', '/v1/profiles/api-atlas-b', {token: b.token}), [200]).payload.data
    recordAssertion('approval increments follower count once', acceptedOwnerProfile.followerCount === followerCountBefore + 1)
    record('write acceptance A post delete', await call('DELETE', `/v1/posts/${ownPost.id}`, {token: a.token}), [200])
    fixtures.posts = fixtures.posts.filter(item => item.id !== ownPost.id)
  } finally {
    for (const item of fixtures.follows.reverse()) {
      const result = await call('DELETE', `/v1/profiles/${item.profileId}/follow`, {token: item.token})
      const verification = await call('GET', '/v1/profiles/api-atlas-b', {token: item.token})
      cleanupResult('follow', digest(item.profileId), result, [200, 404], verification.status, [404])
    }
    for (const item of fixtures.comments.reverse()) {
      const result = await call('DELETE', `/v1/comments/${item.id}`, {token: item.token})
      cleanupResult('comment', digest(item.id), result, [200])
    }
    for (const item of fixtures.posts.reverse()) {
      const result = await call('DELETE', `/v1/posts/${item.id}`, {token: item.token})
      cleanupResult('post', digest(item.id), result, [200])
    }
    for (const item of fixtures.attachments.reverse()) {
      const result = await call('DELETE', `/v1/attachments/${item.id}`, {token: item.token})
      cleanupResult('attachment', digest(item.id), result, [200])
    }
    for (const item of fixtures.records.reverse()) {
      const result = await call('DELETE', `/v1/repositories/me/records/${item.id}`, {token: item.token, body: {expectedRevision: item.revision}})
      cleanupResult('record', digest(item.id), result, [200])
    }
    for (const item of fixtures.preferences.reverse()) {
      const result = await call('PATCH', '/v1/accounts/me/app-preferences', {token: item.token, body: {preferences: item.preferences}})
      const verification = await call('GET', '/v1/accounts/me/app-preferences', {token: item.token})
      const restored = result.status === 200 && verification.status === 200 && JSON.stringify(verification.payload?.data?.preferences) === JSON.stringify(item.preferences)
      cleanup.push({resource: 'settings-preferences', key: item.key, status: result.status, verificationStatus: verification.status, disposition: 'restored through supported PATCH; audit-owned row retained because no delete route exists', result: restored ? 'PASS' : 'FAIL'})
    }
    if (profileB) {
      const current = await call('GET', '/v1/profiles/api-atlas-b', {token: b.token})
      if (current.status === 200) {
        const restored = await call('PATCH', '/v1/profiles/me', {token: b.token, body: {visibility: 'private', expectedVersion: current.payload.data.version}})
        cleanupResult('profile-visibility', 'api-atlas-b', restored, [200])
      }
    }
  }

  const version = await call('GET', '/version.json')
  const evidence = {
    metadata: {
      title: 'API-BASELINE-02 authenticated production acceptance',
      capturedAt: new Date().toISOString(),
      baseUrl,
      markerHash: digest(marker),
      release: version.payload ? {
        commit: version.payload.commit ?? null,
        releaseId: version.payload.releaseId ?? null,
        expectedMigration: version.payload.expectedMigration ?? null,
      } : null,
      identities: ['api-atlas-a', 'api-atlas-b'],
      secretsIncluded: false,
    },
    summary: {
      passed: [...checks, ...cleanup].filter(item => item.result === 'PASS').length,
      failed: [...checks, ...cleanup].filter(item => item.result === 'FAIL').length,
    },
    checks,
    cleanup,
  }
  mkdirSync(dirname(outputPath), {recursive: true})
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {mode: 0o600})
  process.stdout.write(`${JSON.stringify({outputPath, summary: evidence.summary, cleanup}, null, 2)}\n`)
  if (evidence.summary.failed) process.exitCode = 1
}

main().catch(error => {
  mkdirSync(dirname(outputPath), {recursive: true})
  writeFileSync(outputPath, `${JSON.stringify({metadata: {title: 'API-BASELINE-02 authenticated production acceptance', capturedAt: new Date().toISOString(), baseUrl, markerHash: digest(marker), secretsIncluded: false}, summary: {passed: [...checks, ...cleanup].filter(item => item.result === 'PASS').length, failed: [...checks, ...cleanup].filter(item => item.result === 'FAIL').length + 1}, checks, cleanup, fatal: error instanceof Error ? error.message : String(error)}, null, 2)}\n`, {mode: 0o600})
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
