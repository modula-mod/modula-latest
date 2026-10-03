#!/usr/bin/env node
import {createHash, randomUUID} from 'node:crypto'
import {mkdirSync, writeFileSync} from 'node:fs'
import {dirname} from 'node:path'

const baseUrl = (process.env.API_ATLAS_BASE_URL ?? 'https://api.modula.digital').replace(/\/$/, '')
const outputPath = process.env.API_ATLAS_EVIDENCE_PATH ?? '/var/lib/modula/api-atlas/authenticated-acceptance.json'
const marker = `API-BASELINE-02:${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}:${randomUUID()}`
const fixtures = {posts: [], comments: [], attachments: [], records: [], follows: []}
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
  const a = await login(process.env.API_ATLAS_A_EMAIL ?? 'api-atlas-a@audit.invalid', required('API_ATLAS_A_PASSWORD'))
  const b = await login(process.env.API_ATLAS_B_EMAIL ?? 'api-atlas-b@audit.invalid', required('API_ATLAS_B_PASSWORD'))
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

    const follow = record('known gap private follow succeeds immediately', await call('POST', `/v1/profiles/${profileB.id}/follow`, {token: a.token}), [200]).payload.data
    fixtures.follows.push({profileId: profileB.id, token: a.token})
    if (follow.isFollowing !== true) throw new Error('Private follow did not become active immediately as characterized')
    record('known gap private profile visible immediately after follow', await call('GET', '/v1/profiles/api-atlas-b', {token: a.token}), [200])
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
