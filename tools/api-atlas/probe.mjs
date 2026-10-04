#!/usr/bin/env node
import {createHash} from 'node:crypto'
import {mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {evidenceDir, json, sanitizeForSecretScan} from './lib.mjs'

const baseUrl = process.env.API_ATLAS_BASE_URL ?? 'https://api.modula.digital'
const probes = []

async function probe(route, targetPath, expected, options = {}) {
  const method = options.method ?? 'GET'
  const started = performance.now()
  let response
  try {
    response = await fetch(`${baseUrl}${targetPath}`, {
      method,
      headers: {'user-agent': 'modula-api-atlas-01/1.0', ...(options.headers ?? {})},
      body: options.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    const bytes = new Uint8Array(await response.arrayBuffer())
    const latencyMs = Math.round((performance.now() - started) * 10) / 10
    const statusOk = expected.includes(response.status)
    const assertion = options.assert ? options.assert({response, bytes}) : {ok: true}
    const record = {
      method,
      path: route,
      targetPath,
      status: response.status,
      expectedStatus: expected,
      latencyMs,
      contentType: response.headers.get('content-type'),
      contentLength: bytes.byteLength,
      requestIdPresent: Boolean(response.headers.get('x-request-id')),
      result: statusOk && assertion.ok ? 'PASS' : 'FAIL',
      assertion: assertion.note ?? null,
    }
    probes.push(record)
    return {record, response, bytes}
  } catch (error) {
    const record = {method, path: route, targetPath, status: null, expectedStatus: expected, latencyMs: Math.round((performance.now() - started) * 10) / 10, result: 'ERROR', assertion: error instanceof Error ? error.message : String(error)}
    probes.push(record)
    return {record, response: null, bytes: new Uint8Array()}
  }
}

function parseJson(bytes) {
  try { return JSON.parse(new TextDecoder().decode(bytes)) } catch { return null }
}

await probe('GET /version.json', '/version.json', [200])
for (let index = 0; index < 3; index += 1) await probe('GET /v1/health/live', '/v1/health/live', [200])
await probe('GET /v1/health/ready', '/v1/health/ready', [200])
for (let index = 0; index < 3; index += 1) await probe('GET /v1/status', '/v1/status', [200])
await probe('GET /v1/meta', '/v1/meta', [200])
const catalogue = await probe('GET /v1/registry/modules', '/v1/registry/modules', [200])
for (let index = 1; index < 3; index += 1) await probe('GET /v1/registry/modules', '/v1/registry/modules', [200])

const catalogueBody = parseJson(catalogue.bytes)
const items = Array.isArray(catalogueBody?.data?.items) ? catalogueBody.data.items : []
const primaryId = items.some(item => item.moduleId === 'digital.modula.vault-notes') ? 'digital.modula.vault-notes' : items.find(item => item.installable)?.moduleId
if (primaryId) {
  const detail = await probe('GET /v1/registry/modules/:moduleId', `/v1/registry/modules/${encodeURIComponent(primaryId)}`, [200])
  const body = parseJson(detail.bytes)?.data
  const version = body?.latestVersion
  const releaseId = body?.registryReleaseId
  if (version) {
    await probe('GET /v1/registry/modules/:moduleId/versions', `/v1/registry/modules/${encodeURIComponent(primaryId)}/versions`, [200])
    await probe('GET /v1/registry/modules/:moduleId/versions/:version', `/v1/registry/modules/${encodeURIComponent(primaryId)}/versions/${encodeURIComponent(version)}`, [200])
  }
  if (releaseId) {
    await probe('GET /v1/registry/releases/:releaseId/artifact', `/v1/registry/releases/${encodeURIComponent(releaseId)}/artifact`, [200], {
      assert: ({bytes}) => {
        const digest = createHash('sha256').update(bytes).digest('hex')
        return {ok: digest === body.releaseSha256, note: digest === body.releaseSha256 ? 'response SHA-256 matches published release digest' : 'response digest mismatch'}
      },
    })
    const asset = body?.presentation?.icon
    if (asset?.assetId) {
      await probe('GET /v1/registry/releases/:releaseId/assets/:assetId', `/v1/registry/releases/${encodeURIComponent(releaseId)}/assets/${encodeURIComponent(asset.assetId)}`, [200], {
        assert: ({bytes}) => {
          const digest = createHash('sha256').update(bytes).digest('hex')
          return {ok: asset.available === true && digest === asset.sha256, note: digest === asset.sha256 ? 'asset is available and SHA-256 matches metadata' : 'asset availability or digest mismatch'}
        },
      })
    }
  }
}

const unavailable = await probe('GET /v1/registry/modules/:moduleId', '/v1/registry/modules/digital.modula.vault-notes.ai', [200])
const unavailableBody = parseJson(unavailable.bytes)?.data
if (unavailableBody?.registryReleaseId && unavailableBody?.presentation?.icon?.assetId) {
  await probe('GET /v1/registry/releases/:releaseId/assets/:assetId', `/v1/registry/releases/${encodeURIComponent(unavailableBody.registryReleaseId)}/assets/${encodeURIComponent(unavailableBody.presentation.icon.assetId)}`, [404], {
    assert: () => ({ok: unavailableBody.presentation.icon.available === false, note: 'metadata declares unavailable and delivery returns 404'}),
  })
}

await probe('GET /v1/registry/modules/:moduleId', '/v1/registry/modules/api-atlas-01-unknown', [404])
await probe('GET /v1/profiles/:handle', '/v1/profiles/api-atlas-01-does-not-exist', [404])
await probe('GET /v1/accounts/me', '/v1/accounts/me', [401])
await probe('GET /v1/modules/installed', '/v1/modules/installed', [401])
await probe('GET /v1/intelligence/missions', '/v1/intelligence/missions', [401])
await probe('GET /v1/support/cases', '/v1/support/cases', [401])
await probe('GET /v1/accounts/me/app-preferences', '/v1/accounts/me/app-preferences', [401])
await probe('PATCH /v1/accounts/me/app-preferences', '/v1/accounts/me/app-preferences', [401], {method: 'PATCH', headers: {'content-type': 'application/json'}, body: '{}'})
await probe('GET /v1/accounts/me/mutes', '/v1/accounts/me/mutes', [401])
await probe('GET /v1/accounts/me/blocks', '/v1/accounts/me/blocks', [401])
await probe('GET /v1/creator/insights', '/v1/creator/insights', [401])
await probe('GET /v1/creator/payouts', '/v1/creator/payouts', [401])
await probe('GET /v1/commerce/invoices', '/v1/commerce/invoices', [401])
await probe('POST /v1/auth/step-up/password', '/v1/auth/step-up/password', [401], {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'})
await probe('GET /v1/account/deletion-requests/current', '/v1/account/deletion-requests/current', [401])
await probe('POST /v1/accounts/register', '/v1/accounts/register', [400], {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'})

const latency = {}
for (const route of ['GET /v1/health/live', 'GET /v1/status', 'GET /v1/registry/modules']) {
  const values = probes.filter(item => item.path === route && item.result === 'PASS').map(item => item.latencyMs).sort((a, b) => a - b)
  latency[route] = values.length ? {samples: values.length, minimumMs: values[0], medianMs: values[Math.floor(values.length / 2)], maximumMs: values.at(-1)} : {samples: 0}
}

const output = {capturedAt: new Date().toISOString(), baseUrl, policy: 'anonymous and non-mutating except a schema-invalid registration request that cannot persist', probes, latency}
mkdirSync(evidenceDir, {recursive: true})
writeFileSync(join(evidenceDir, 'live-probes.json'), sanitizeForSecretScan(json(output)))
const failures = probes.filter(item => item.result !== 'PASS')
process.stdout.write(`Recorded ${probes.length} safe production probes; failures: ${failures.length}.\n`)
if (failures.length) process.exitCode = 1
