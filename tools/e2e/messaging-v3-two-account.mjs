#!/usr/bin/env node
// GF-MSG-01: disposable-stack, two-account messaging v3 E2E harness.
//
// One command (see docs/validation/gf-msg-01-messaging-v3-e2e.md):
//
//   MODULA_E2E_ADMIN_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55533/postgres \
//     node tools/e2e/messaging-v3-two-account.mjs
//
// It creates a fresh throwaway database on the loopback Postgres, applies the
// migration chain, starts a REAL GreenField API process (dist/main.js) bound
// to 127.0.0.1, then drives two accounts (plus one outsider used only for
// denial checks) over HTTP and the messaging WebSocket. All setup — accounts,
// follows, blocks, requests — goes through public HTTP routes; the harness
// never writes to the database. On exit it stops the API and drops the
// database (unless --keep-db).
//
// Loopback only: every URL is checked by loopback-guard.mjs and anything else,
// including *.modula.digital and test.modula.*, is refused.
//
// Photo/video attachments are DEFERRED (capability off by default and not
// enabled here); attachments are covered through voice notes only.

import {spawn} from 'node:child_process'
import {Buffer} from 'node:buffer'
import {randomBytes} from 'node:crypto'
import {mkdtempSync, rmSync, existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import net from 'node:net'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {assertLoopbackDatabaseUrls, assertLoopbackHttpUrls} from './loopback-guard.mjs'
import {createOwnedDatabase, dropOwnedDatabase} from './disposable-db.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const apiDir = path.join(repoRoot, 'services', 'greenfield-api')
const args = new Set(process.argv.slice(2))
const keepDb = args.has('--keep-db')
const jsonOut = args.has('--json')

// ---------------------------------------------------------------- results --

const results = []
let currentCase = null
async function scenario(id, title, fn) {
  currentCase = {id, title, status: 'PASS', checks: 0, failures: [], notes: []}
  results.push(currentCase)
  try {
    await fn()
  } catch (error) {
    currentCase.status = 'FAIL'
    currentCase.failures.push(`threw: ${error?.message ?? error}`)
  }
  if (currentCase.failures.length > 0) currentCase.status = 'FAIL'
  log(`${currentCase.status === 'PASS' ? 'PASS' : 'FAIL'}  ${id}  ${title}  (${currentCase.checks} checks)`)
  for (const failure of currentCase.failures) log(`        - ${failure}`)
}
function check(condition, label) {
  currentCase.checks += 1
  if (!condition) currentCase.failures.push(label)
  return Boolean(condition)
}
function equal(actual, expected, label) {
  return check(Object.is(actual, expected), `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}
function note(text) { currentCase.notes.push(text) }
function deferred(id, title, reason) {
  results.push({id, title, status: 'DEFERRED', checks: 0, failures: [], notes: [reason]})
  log(`DEFER ${id}  ${title}  (${reason})`)
}
function log(line) { process.stderr.write(`${line}\n`) }

// ------------------------------------------------------------- stack setup --

const adminUrl = process.env.MODULA_E2E_ADMIN_DATABASE_URL
// libpq-style PG* variables are defaults pg may fall back to; none may steer
// the harness's own connections (the API child gets a scrubbed env anyway).
for (const key of Object.keys(process.env)) if (/^PG[A-Z]/.test(key)) delete process.env[key]
const requirePg = createRequire(path.join(apiDir, 'package.json'))

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address()
      server.close(() => resolve(port))
    })
  })
}

/** Everything this run owns and must tear down, whichever way it ends. */
const stack = {child: null, exited: null, mediaRoot: null, database: null}
let cleanupPromise = null
/** Idempotent cleanup: API child, media dir, and the database only if this run created it. */
function cleanup(reason) {
  if (!cleanupPromise) cleanupPromise = (async () => {
    if (stack.child && stack.child.exitCode === null && stack.child.signalCode === null) {
      stack.child.kill('SIGTERM')
      await Promise.race([stack.exited, sleep(10_000)])
      if (stack.child.exitCode === null && stack.child.signalCode === null) stack.child.kill('SIGKILL')
    }
    if (stack.mediaRoot) rmSync(stack.mediaRoot, {recursive: true, force: true})
    if (stack.database?.created) {
      if (keepDb && reason === 'finished') {
        log(`kept database ${stack.database.name}`)
      } else {
        await withAdmin(client => dropOwnedDatabase(sql => client.query(sql), stack.database))
          .catch(error => log(`warning: could not drop ${stack.database.name}: ${error.message}`))
      }
    }
  })()
  return cleanupPromise
}
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => {
    log(`received ${signal}: cleaning up (API process, media dir, owned database) and exiting ${code}`)
    const force = setTimeout(() => process.exit(code), 20_000)
    cleanup('signal').finally(() => { clearTimeout(force); process.exit(code) })
  })
}

async function withAdmin(fn) {
  const {Client} = requirePg('pg')
  const client = new Client({connectionString: adminUrl})
  await client.connect()
  try { return await fn(client) } finally { await client.end() }
}

function databaseUrlFor(name) {
  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  return url.toString()
}

async function startApi({databaseUrl, port, mediaRoot}) {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'development',
    MODULA_ENVIRONMENT: 'development',
    MODULA_API_HOST: '127.0.0.1',
    MODULA_API_PORT: String(port),
    MODULA_PUBLIC_API_URL: `http://127.0.0.1:${port}`,
    MODULA_DATABASE_URL: databaseUrl,
    MODULA_DATABASE_MIGRATOR_URL: databaseUrl,
    MODULA_ALLOWED_ORIGINS: 'http://localhost:8081',
    MODULA_PREVIEW_WRITES_ENABLED: 'true',
    MODULA_INVITE_ONLY: 'true',
    MODULA_REGISTRATION_INVITE_CODES: 'e2e-invite',
    MODULA_ATPROTO_ENABLED: 'false',
    MODULA_RATE_LIMIT_ENABLED: 'false',
    MODULA_MEDIA_ROOT: mediaRoot,
    MODULA_LOG_LEVEL: 'warn',
  }
  const child = spawn(process.execPath, [path.join(apiDir, 'dist', 'main.js')], {cwd: apiDir, env, stdio: ['ignore', 'pipe', 'pipe']})
  stack.child = child
  let output = ''
  const capture = chunk => { output = (output + chunk.toString()).slice(-20_000) }
  child.stdout.on('data', capture)
  child.stderr.on('data', capture)
  const exited = new Promise(resolve => child.once('exit', code => resolve(code)))
  stack.exited = exited
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited during startup (code ${child.exitCode}):\n${output.slice(-4000)}`)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/v1/health/live`)
      if (res.ok) return {child, exited, output: () => output}
    } catch { /* not listening yet */ }
    await sleep(150)
  }
  child.kill('SIGKILL')
  throw new Error(`API did not become live within 30 s:\n${output.slice(-4000)}`)
}

// ------------------------------------------------------------ HTTP / socket --

let base = ''
async function http(method, url, {token, body, headers = {}, raw} = {}) {
  const init = {method, headers: {...headers}}
  if (token) init.headers.authorization = `Bearer ${token}`
  if (raw !== undefined) init.body = raw
  else if (body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body) }
  const res = await fetch(`${base}${url}`, init)
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* binary or empty */ }
  return {status: res.status, json, data: json?.data, text}
}

/** Raw upgrade probe: returns the HTTP status the server answers with. */
function upgradeStatus(port, token) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => socket.write([
      'GET /v1/messaging/socket HTTP/1.1', `Host: 127.0.0.1:${port}`, 'Connection: Upgrade', 'Upgrade: websocket',
      'Sec-WebSocket-Version: 13', `Sec-WebSocket-Key: ${randomBytes(16).toString('base64')}`,
      ...(token ? [`Authorization: Bearer ${token}`] : []), '', '',
    ].join('\r\n')))
    let data = ''
    socket.setTimeout(5000, () => { socket.destroy(); reject(new Error('upgrade probe timed out')) })
    socket.on('data', chunk => {
      data += chunk.toString('latin1')
      const match = /^HTTP\/1\.1 (\d{3})/.exec(data)
      if (match) { socket.destroy(); resolve(Number(match[1])) }
    })
    socket.on('error', reject)
  })
}

/** Real WebSocket client (Node's built-in WebSocket, bearer header). */
async function openSocket(socketUrl, token) {
  const events = []
  const ws = new WebSocket(socketUrl, {headers: {authorization: `Bearer ${token}`}})
  ws.addEventListener('message', event => {
    try { events.push(JSON.parse(String(event.data))) } catch { events.push({type: 'unparseable'}) }
  })
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, {once: true})
    ws.addEventListener('error', () => reject(new Error('socket failed to open')), {once: true})
  })
  await waitFor(() => events.some(e => e.type === 'hello'), 'socket hello')
  const closed = new Promise(resolve => ws.addEventListener('close', resolve, {once: true}))
  return {
    ws, events,
    has: predicate => events.some(predicate),
    send: frame => ws.send(JSON.stringify(frame)),
    drop: async () => { ws.close(); await Promise.race([closed, sleep(2000)]) },
  }
}

// -------------------------------------------------------------- accounts --

const runSuffix = `${Date.now().toString(36).slice(-5)}${randomBytes(2).toString('hex')}`
async function register(prefix) {
  const handle = `${prefix}${runSuffix}`.slice(0, 20)
  const email = `${handle}@example.test`
  const password = `e2e-${randomBytes(12).toString('hex')}`
  const created = await http('POST', '/v1/accounts/register', {body: {email, password, handle, displayName: handle, acceptedTerms: true, inviteCode: 'e2e-invite'}})
  if (created.status !== 201) throw new Error(`register ${prefix} -> ${created.status} ${created.text.slice(0, 300)}`)
  const verificationToken = created.data?.verificationToken
  if (!verificationToken) throw new Error('register did not return a development verification token')
  const verified = await http('POST', '/v1/accounts/verify-email', {body: {token: verificationToken}})
  if (verified.status !== 200) throw new Error(`verify-email ${prefix} -> ${verified.status}`)
  const session = await http('POST', '/v1/sessions', {body: {email, password}})
  if (session.status !== 200) throw new Error(`session ${prefix} -> ${session.status}`)
  const token = session.data.accessToken
  const profile = await http('GET', `/v1/profiles/${handle}`, {token})
  if (profile.status !== 200) throw new Error(`profile ${prefix} -> ${profile.status}`)
  const profileId = profile.data?.profile?.id ?? profile.data?.id
  return {handle, token, profileId, actorId: null}
}

/** The messaging socket's `hello` frame is the public source of the caller's actor id. */
async function resolveActorId(socketUrl, member) {
  const sock = await openSocket(socketUrl, member.token)
  member.actorId = sock.events.find(e => e.type === 'hello')?.actorId ?? null
  await sock.drop()
  return member.actorId
}

// Minimal ISO-BMFF header with an M4A brand: passes the attachment signature
// check; not playable audio.
const M4A = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypM4A ', 'latin1'), Buffer.from([0, 0, 0, 0]),
  Buffer.from('M4A isom', 'latin1'), Buffer.alloc(64, 1),
])
async function uploadVoice(token) {
  const created = await http('POST', '/v1/attachments/uploads', {token, body: {filename: 'voice.m4a', mimeType: 'audio/mp4', size: M4A.length}})
  if (created.status !== 201) throw new Error(`upload session -> ${created.status} ${created.text.slice(0, 200)}`)
  const put = await http('PUT', `/v1/attachments/uploads/${created.data.uploadId}/content`, {token, raw: M4A, headers: {'content-type': 'application/octet-stream'}})
  if (put.status !== 200) throw new Error(`upload content -> ${put.status} ${put.text.slice(0, 200)}`)
  return created.data.attachmentId
}

// --------------------------------------------------------------- scenario --

async function runScenario(port) {
  const socketUrl = `ws://127.0.0.1:${port}/v1/messaging/socket`
  assertLoopbackHttpUrls({socketUrl})
  let alice, bob, outsider, dm, group

  await scenario('setup', 'register two accounts + outsider and connect them over HTTP only', async () => {
    alice = await register('e2ea')
    bob = await register('e2eb')
    outsider = await register('e2eo')
    check(alice.profileId && bob.profileId && outsider.profileId, 'profiles resolved by handle')
    for (const member of [alice, bob, outsider]) check(await resolveActorId(socketUrl, member), `${member.handle} actor id from socket hello`)
    equal((await http('POST', `/v1/profiles/${alice.profileId}/follow`, {token: bob.token})).status, 200, 'bob follows alice')
    equal((await http('POST', `/v1/profiles/${bob.profileId}/follow`, {token: alice.token})).status, 200, 'alice follows bob')
  })
  if (!alice || !bob || !outsider) throw new Error('setup failed; cannot continue')

  await scenario('capabilities', 'v3 capabilities, photo/video off, single-instance realtime flag', async () => {
    const caps = (await http('GET', '/v1/messaging/capabilities', {token: alice.token})).data ?? {}
    equal(caps.version, 3, 'version')
    equal(caps.voiceNotes, true, 'voiceNotes')
    equal(caps.photoVideo, false, 'photoVideo off by default')
    equal(caps.realtime?.socketPath, '/v1/messaging/socket', 'socketPath')
    equal(caps.realtime?.singleInstance, true, 'realtime.singleInstance (in-memory fan-out, one API instance)')
    equal((await http('GET', '/v1/messaging/capabilities')).status, 401, 'unauthenticated capabilities')
  })

  await scenario('socket-auth', 'socket upgrade requires a valid bearer before the handshake', async () => {
    equal(await upgradeStatus(port), 401, 'no token')
    equal(await upgradeStatus(port, 'not-a-real-token'), 401, 'garbage token')
    equal(await upgradeStatus(port, bob.token), 101, 'valid token')
  })

  await scenario('dm', 'alice opens a DM with bob; bob sees it in his inbox, not as a request', async () => {
    const opened = await http('POST', '/v1/conversations', {token: alice.token, body: {handle: bob.handle}})
    check(opened.status === 200 || opened.status === 201, `open DM status ${opened.status}`)
    dm = opened.data?.conversation
    check(dm?.id, 'conversation id')
    const first = await http('POST', `/v1/conversations/${dm.id}/messages`, {token: alice.token, body: {text: 'hello bob'}})
    equal(first.status, 201, 'first send')
    const inbox = (await http('GET', '/v1/conversations', {token: bob.token})).data?.items ?? []
    check(inbox.some(c => c.id === dm.id), 'DM in bob inbox')
    const requests = (await http('GET', '/v1/message-requests', {token: bob.token})).data?.items ?? []
    check(!requests.some(r => r.id === dm.id), 'DM is not a message request for a follower')
  })
  if (!dm?.id) throw new Error('DM setup failed; cannot continue')

  await scenario('realtime', 'socket delivers member events only, without message bodies', async () => {
    const bobSock = await openSocket(socketUrl, bob.token)
    const outsiderSock = await openSocket(socketUrl, outsider.token)
    const sent = await http('POST', `/v1/conversations/${dm.id}/messages`, {token: alice.token, body: {text: 'realtime hello'}})
    equal(sent.status, 201, 'send')
    await waitFor(() => bobSock.has(e => e.type === 'message.created' && e.messageId === sent.data.message.id), 'bob message.created')
    const created = bobSock.events.find(e => e.type === 'message.created' && e.messageId === sent.data.message.id)
    equal(created?.conversationId, dm.id, 'event conversationId')
    equal(created?.body, undefined, 'event carries no body (fetch via REST)')
    await sleep(150)
    check(!outsiderSock.has(e => e.type === 'message.created'), 'outsider socket received nothing')
    bobSock.send({type: 'typing', conversationId: 'not-mine'})
    await waitFor(() => bobSock.has(e => e.type === 'error' && e.reason === 'not-found'), 'typing on foreign conversation rejected')
    await bobSock.drop()
    await outsiderSock.drop()
  })

  await scenario('reconnect', 'socket drop: REST stays the source of truth; reconnect resumes live events', async () => {
    let bobSock = await openSocket(socketUrl, bob.token)
    await bobSock.drop()
    const missed = []
    for (const text of ['while offline 1', 'while offline 2']) {
      const res = await http('POST', `/v1/conversations/${dm.id}/messages`, {token: alice.token, body: {text}})
      equal(res.status, 201, `send "${text}" while bob is disconnected`)
      missed.push(res.data?.message?.id)
    }
    bobSock = await openSocket(socketUrl, bob.token)
    await sleep(300)
    const replayed = missed.filter(id => bobSock.has(e => e.type === 'message.created' && e.messageId === id))
    note(`socket replayed ${replayed.length}/${missed.length} missed events after reconnect (no replay is expected; REST is authoritative)`)
    equal(replayed.length, 0, 'socket does not replay missed events')
    const thread = (await http('GET', `/v1/conversations/${dm.id}/messages`, {token: bob.token})).data?.items ?? []
    check(missed.every(id => thread.some(m => m.id === id)), 'REST thread contains every message sent while disconnected')
    const live = await http('POST', `/v1/conversations/${dm.id}/messages`, {token: alice.token, body: {text: 'after reconnect'}})
    await waitFor(() => bobSock.has(e => e.type === 'message.created' && e.messageId === live.data?.message?.id), 'live event after reconnect')
    check(true, 'live event after reconnect')
    await bobSock.drop()
  })

  await scenario('receipts', 'read receipts, delivery state and reciprocal receipt privacy', async () => {
    const msg = (await http('POST', `/v1/conversations/${dm.id}/messages`, {token: alice.token, body: {text: 'read me'}})).data.message
    equal((await http('POST', `/v1/conversations/${dm.id}/read`, {token: bob.token, body: {}})).status, 200, 'bob marks read')
    const receipts = (await http('GET', `/v1/conversations/${dm.id}/messages/${msg.id}/receipts`, {token: alice.token})).data
    check((receipts?.readBy ?? []).some(r => r.participant?.handle === bob.handle), 'alice sees bob in readBy')
    const thread = (await http('GET', `/v1/conversations/${dm.id}/messages`, {token: alice.token})).data?.items ?? []
    equal(thread.find(m => m.id === msg.id)?.delivery, 'read', 'delivery=read for alice')
    equal((await http('GET', `/v1/conversations/${dm.id}/messages/${msg.id}/receipts`, {token: outsider.token})).status, 404, 'outsider cannot read receipts')

    equal((await http('PATCH', '/v1/messaging/privacy', {token: bob.token, body: {readReceipts: false}})).status, 200, 'bob turns receipts off')
    const hidden = (await http('POST', `/v1/conversations/${dm.id}/messages`, {token: alice.token, body: {text: 'read me quietly'}})).data.message
    await http('POST', `/v1/conversations/${dm.id}/read`, {token: bob.token, body: {}})
    const afterOff = (await http('GET', `/v1/conversations/${dm.id}/messages`, {token: alice.token})).data?.items ?? []
    check(afterOff.find(m => m.id === hidden.id)?.delivery !== 'read', 'alice never sees read once bob turned receipts off')
    const bobMsg = (await http('POST', `/v1/conversations/${dm.id}/messages`, {token: bob.token, body: {text: 'bob says'}})).data.message
    await http('POST', `/v1/conversations/${dm.id}/read`, {token: alice.token, body: {}})
    const reciprocal = (await http('GET', `/v1/conversations/${dm.id}/messages/${bobMsg.id}/receipts`, {token: bob.token})).data
    equal(reciprocal?.receiptsDisabled, true, 'reciprocal: bob sees receiptsDisabled')
    equal((reciprocal?.readBy ?? []).length, 0, 'reciprocal: bob sees no readers')
    equal((await http('PATCH', '/v1/messaging/privacy', {token: bob.token, body: {readReceipts: true}})).status, 200, 'restore receipts')
  })

  await scenario('typing', 'typing indicators over REST and socket, and the privacy toggle', async () => {
    const bobSock = await openSocket(socketUrl, bob.token)
    equal((await http('POST', `/v1/conversations/${dm.id}/typing`, {token: alice.token, body: {}})).data?.published, true, 'typing published')
    await waitFor(() => bobSock.has(e => e.type === 'typing' && e.conversationId === dm.id), 'bob socket typing event')
    check(true, 'typing event delivered')
    await http('PATCH', '/v1/messaging/privacy', {token: alice.token, body: {typingIndicators: false}})
    equal((await http('POST', `/v1/conversations/${dm.id}/typing`, {token: alice.token, body: {}})).data?.published, false, 'typing not published when off')
    equal(((await http('GET', `/v1/conversations/${dm.id}/typing`, {token: bob.token})).data?.typing ?? []).length, 0, 'bob sees nobody typing')
    await http('PATCH', '/v1/messaging/privacy', {token: alice.token, body: {typingIndicators: true}})
    await bobSock.drop()
  })

  await scenario('groups', 'group create, roles, mentions, member-only access, realtime and leave', async () => {
    const created = await http('POST', '/v1/groups', {token: alice.token, body: {title: `E2E ${runSuffix}`, handles: [bob.handle]}})
    equal(created.status, 201, 'create group')
    group = created.data?.conversation
    equal(group?.group?.myRole, 'owner', 'alice is owner')
    equal((await http('GET', `/v1/groups/${group.id}`, {token: outsider.token})).status, 404, 'outsider cannot read group')
    equal((await http('POST', `/v1/conversations/${group.id}/messages`, {token: outsider.token, body: {text: 'hi'}})).status, 404, 'outsider cannot post')
    const bobView = await http('GET', `/v1/groups/${group.id}`, {token: bob.token})
    equal(bobView.status, 200, 'bob reads group')
    const bobRole = bobView.data?.group?.myRole
    note(`bob joined the group as ${bobRole ?? 'pending request'} (follows alice)`)
    if (bobRole !== 'member') {
      // Not a follower-accepted member yet: accept the request through HTTP.
      equal((await http('POST', `/v1/message-requests/${group.id}/accept`, {token: bob.token, body: {}})).status, 200, 'bob accepts group request')
    }
    equal((await http('PATCH', `/v1/groups/${group.id}`, {token: bob.token, body: {title: 'Mine'}})).status, 403, 'member cannot rename')
    equal((await http('POST', `/v1/groups/${group.id}/members/${bob.actorId}/role`, {token: alice.token, body: {role: 'admin'}})).status, 200, 'owner promotes bob')
    const renamed = await http('PATCH', `/v1/groups/${group.id}`, {token: bob.token, body: {title: `E2E renamed ${runSuffix}`}})
    equal(renamed.status, 200, 'admin renames')
    const bobSock = await openSocket(socketUrl, bob.token)
    const mention = await http('POST', `/v1/conversations/${group.id}/messages`, {token: alice.token, body: {text: `hi @${bob.handle} and @${outsider.handle}`}})
    equal(mention.status, 201, 'mention send')
    const mentions = mention.data?.message?.mentions ?? []
    check(mentions.length === 1 && mentions[0].handle === bob.handle, `mentions resolve to members only: ${JSON.stringify(mentions)}`)
    await waitFor(() => bobSock.has(e => e.type === 'message.created' && e.conversationId === group.id), 'bob group event')
    check(true, 'group realtime event')
    await bobSock.drop()
    equal((await http('POST', `/v1/groups/${group.id}/leave`, {token: bob.token, body: {}})).status, 200, 'bob leaves')
    equal((await http('GET', `/v1/groups/${group.id}`, {token: bob.token})).status, 404, 'left member loses access')
  })

  await scenario('presence', 'presence for contacts only; "nobody" hides both ways', async () => {
    equal((await http('POST', '/v1/presence/heartbeat', {token: bob.token, body: {}})).status, 200, 'bob heartbeat')
    await http('POST', '/v1/presence/heartbeat', {token: outsider.token, body: {}})
    let items = (await http('GET', `/v1/presence?actorIds=${bob.actorId},${outsider.actorId}`, {token: alice.token})).data?.items ?? []
    equal(items.find(p => p.actorId === bob.actorId)?.status, 'online', 'contact is online')
    equal(items.find(p => p.actorId === outsider.actorId)?.status, 'hidden', 'non-contact is hidden')
    await http('PATCH', '/v1/messaging/privacy', {token: bob.token, body: {presenceVisibility: 'nobody'}})
    items = (await http('GET', `/v1/presence?actorIds=${bob.actorId}`, {token: alice.token})).data?.items ?? []
    equal(items[0]?.status, 'hidden', 'bob hidden from alice')
    await http('POST', '/v1/presence/heartbeat', {token: alice.token, body: {}})
    items = (await http('GET', `/v1/presence?actorIds=${alice.actorId}`, {token: bob.token})).data?.items ?? []
    equal(items[0]?.status, 'hidden', 'reciprocal: bob cannot see alice')
    await http('PATCH', '/v1/messaging/privacy', {token: bob.token, body: {presenceVisibility: 'contacts'}})
  })

  await scenario('attachments-voice', 'voice note through the attachment pipeline, member-only playback', async () => {
    const attachmentId = await uploadVoice(alice.token)
    equal((await http('POST', `/v1/conversations/${dm.id}/messages`, {token: alice.token, body: {kind: 'media', attachments: [{attachmentId}]}})).status, 403, 'photo/video kind refused while capability is off')
    const sent = await http('POST', `/v1/conversations/${dm.id}/messages`, {token: alice.token, body: {kind: 'voice', attachments: [{attachmentId, durationMs: 4200, waveform: [0.1, 0.5, 0.9]}]}})
    equal(sent.status, 201, 'voice send')
    const message = sent.data?.message
    equal(message?.attachments?.[0]?.kind, 'audio', 'attachment kind')
    const thread = (await http('GET', `/v1/conversations/${dm.id}/messages`, {token: bob.token})).data?.items ?? []
    check(thread.some(m => m.id === message.id && m.kind === 'voice'), 'bob sees the voice note')
    const content = await http('GET', `/v1/attachments/${attachmentId}/content`, {token: bob.token})
    equal(content.status, 200, 'member playback')
    equal((await http('GET', `/v1/attachments/${attachmentId}/content`, {token: outsider.token})).status, 403, 'outsider playback refused')
    equal((await http('GET', `/v1/attachments/${attachmentId}/content`)).status, 403, 'anonymous playback refused')
    await http('DELETE', `/v1/conversations/${dm.id}/messages/${message.id}`, {token: alice.token})
    equal((await http('GET', `/v1/attachments/${attachmentId}/content`, {token: bob.token})).status, 403, 'playback revoked after unsend')
  })

  await scenario('privacy-search', 'history search and thread access are scoped to the viewer', async () => {
    const marker = `zebra${runSuffix}`
    await http('POST', `/v1/conversations/${dm.id}/messages`, {token: alice.token, body: {text: `${marker} private`}})
    const bobHits = (await http('GET', `/v1/messages/search?q=${marker}`, {token: bob.token})).data?.items ?? []
    check(bobHits.some(h => h.conversationId === dm.id), 'participant finds the message')
    const outsiderHits = (await http('GET', `/v1/messages/search?q=${marker}`, {token: outsider.token})).data?.items ?? []
    equal(outsiderHits.length, 0, 'outsider search finds nothing')
    equal((await http('GET', `/v1/conversations/${dm.id}/messages`, {token: outsider.token})).status, 404, 'outsider cannot read the DM')
    equal((await http('GET', `/v1/messages/search?q=${marker}&conversationId=${dm.id}`, {token: outsider.token})).status, 404, 'outsider scoped search 404')
  })

  await scenario('idempotency', 'concurrent sends with one clientMessageId create one message', async () => {
    const payload = {text: 'only once', clientMessageId: `e2e-${runSuffix}-1`}
    const results3 = await Promise.all([1, 2, 3].map(() => http('POST', `/v1/conversations/${dm.id}/messages`, {token: alice.token, body: payload})))
    equal(JSON.stringify(results3.map(r => r.status).sort()), JSON.stringify([200, 200, 201]), 'one 201 and two replays')
    equal(new Set(results3.map(r => r.data?.message?.id)).size, 1, 'same message id')
    const thread = (await http('GET', `/v1/conversations/${dm.id}/messages`, {token: bob.token})).data?.items ?? []
    equal(thread.filter(m => m.body === 'only once').length, 1, 'REST thread has exactly one copy')
  })

  await scenario('blocks', 'a block stops DM sends both ways and hides new messages', async () => {
    equal((await http('POST', `/v1/profiles/${alice.profileId}/block`, {token: bob.token, body: {}})).status, 200, 'bob blocks alice')
    const aliceSend = await http('POST', `/v1/conversations/${dm.id}/messages`, {token: alice.token, body: {text: 'after block from alice'}})
    check(aliceSend.status >= 400, `alice cannot send after the block (status ${aliceSend.status})`)
    const bobSend = await http('POST', `/v1/conversations/${dm.id}/messages`, {token: bob.token, body: {text: 'after block from bob'}})
    check(bobSend.status >= 400, `bob cannot send to someone he blocked (status ${bobSend.status})`)
    const bobThread = await http('GET', `/v1/conversations/${dm.id}/messages`, {token: bob.token})
    check(!(bobThread.data?.items ?? []).some(m => m.body === 'after block from alice'), 'blocked message never reaches bob')
    const blockedGroup = await http('POST', '/v1/groups', {token: alice.token, body: {title: 'blocked', handles: [bob.handle]}})
    equal(blockedGroup.status, 403, 'blocked user cannot be added to a new group')
    equal((await http('DELETE', `/v1/profiles/${alice.profileId}/block`, {token: bob.token})).status, 200, 'unblock')
  })

  deferred('attachments-photo-video', 'photo/video message attachments', 'capability photoVideo=false by default; not enabled (GF-MSG-01 scope decision, pending ATLAS)')
  deferred('multi-instance-fanout', 'socket fan-out across API replicas', 'capabilities advertise realtime.singleInstance=true; multi-replica fan-out is not implemented')
}

// ------------------------------------------------------------------ main --

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }
async function waitFor(predicate, label, timeoutMs = 3000) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${label}`)
    await sleep(15)
  }
}

async function main() {
  assertLoopbackDatabaseUrls({MODULA_E2E_ADMIN_DATABASE_URL: adminUrl})
  if (!existsSync(path.join(apiDir, 'dist', 'main.js'))) {
    throw new Error('services/greenfield-api/dist/main.js is missing; run `pnpm --filter @modula/greenfield-api... build` first')
  }
  const dbName = `gf_msg_01_${runSuffix}`.toLowerCase()
  const databaseUrl = databaseUrlFor(dbName)
  const port = await freePort()
  base = `http://127.0.0.1:${port}`
  assertLoopbackDatabaseUrls({databaseUrl})
  assertLoopbackHttpUrls({apiUrl: base})
  stack.mediaRoot = mkdtempSync(path.join(tmpdir(), 'gf-msg-01-media-'))
  let fatal = null
  const started = Date.now()
  log(`GF-MSG-01 messaging v3 E2E — database ${dbName}, API ${base}`)
  try {
    // CREATE DATABASE fails on a name collision; only a database created here is ever dropped.
    stack.database = {name: dbName, created: false}
    stack.database = await withAdmin(client => createOwnedDatabase(sql => client.query(sql), dbName))
    const {migrateUp} = await import(pathToFileURL(path.join(apiDir, 'dist', 'database', 'migrate.js')).href)
    const applied = await migrateUp(databaseUrl)
    log(`migrations applied: ${applied.length} (tip ${applied.at(-1) ?? 'none'})`)
    const api = await startApi({databaseUrl, port, mediaRoot: stack.mediaRoot})
    try {
      await runScenario(port)
    } catch (error) {
      log(api.output().slice(-3000))
      throw error
    }
  } catch (error) {
    fatal = error
    log(`FATAL ${error?.stack ?? error}`)
  } finally {
    await cleanup('finished')
  }
  const summary = {
    mission: 'GF-MSG-01',
    database: dbName,
    durationMs: Date.now() - started,
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status === 'FAIL').length,
    deferred: results.filter(r => r.status === 'DEFERRED').length,
    checks: results.reduce((n, r) => n + r.checks, 0),
    fatal: fatal ? String(fatal.message ?? fatal) : null,
    cases: results,
  }
  log(`\n${summary.passed} passed, ${summary.failed} failed, ${summary.deferred} deferred, ${summary.checks} checks, ${summary.durationMs} ms`)
  if (jsonOut) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  process.exitCode = fatal || summary.failed > 0 ? 1 : 0
}

try {
  await main()
} catch (error) {
  // Configuration refusals (non-loopback target, missing build) exit before any stack is touched.
  log(`GF-MSG-01 refused to run: ${error?.message ?? error}`)
  process.exitCode = 2
}
