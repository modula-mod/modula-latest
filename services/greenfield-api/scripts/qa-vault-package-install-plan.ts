import {randomUUID} from 'node:crypto'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
if (!databaseUrl || process.env.NODE_ENV === 'production' || process.env.MODULA_ENVIRONMENT === 'production') {
  throw new Error('Only an explicit nonproduction test database is permitted')
}

process.env.NODE_ENV = 'test'
process.env.MODULA_ENVIRONMENT = 'development'
process.env.MODULA_PUBLIC_API_URL ??= 'http://127.0.0.1:14024'
process.env.MODULA_DATABASE_URL = databaseUrl
process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl
process.env.MODULA_ALLOWED_ORIGINS ??= 'https://modula.digital'
process.env.MODULA_CHECKPOINT_SIGNING_KEY ??= 'qa-vault-plan-ephemeral'
process.env.MODULA_INVITE_ONLY = 'false'
process.env.MODULA_REGISTRATION_MODE = 'open'
process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
process.env.GREENFIELD_MODULE_REGISTRY_ENABLED = 'true'
process.env.GREENFIELD_MODULE_INSTALLATION_ENABLED = 'true'
process.env.GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED = 'true'
process.env.GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED = 'true'

const moduleId = 'digital.modula.vault-notes'
const version = '2.0.2'
const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
const {app, db} = await createServer(loadConfig())

function responseData(response: {json(): unknown}): Record<string, any> {
  const body = response.json()
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Response was not an object')
  return body as Record<string, any>
}

function requireStatus(response: {statusCode: number; body: string}, expected: number, label: string): void {
  if (response.statusCode !== expected) throw new Error(`${label} returned ${response.statusCode}: ${response.body}`)
}

try {
  await app.ready()
  const release = await db.selectFrom('greenfield_module_releases')
    .select(['release_id', 'release_state', 'release_sha256', 'source_commit', 'signature_key_id'])
    .where('module_id', '=', moduleId)
    .where('version', '=', version)
    .executeTakeFirstOrThrow()
  if (release.release_state !== 'published' || !release.signature_key_id) {
    throw new Error('Vault Notes QA release must be published and signed before lifecycle verification')
  }

  const email = `vault-plan-${suffix}@example.invalid`
  const password = 'qa-vault-plan-password-1'
  const register = await app.inject({
    method: 'POST',
    url: '/v1/accounts/register',
    payload: {email, password, handle: `vaultplan${suffix}`, displayName: 'Vault Plan QA', acceptedTerms: true},
  })
  requireStatus(register, 201, 'register')
  const registerBody = responseData(register)
  const verify = await app.inject({
    method: 'POST',
    url: '/v1/accounts/verify-email',
    payload: {token: registerBody.data.verificationToken},
  })
  requireStatus(verify, 200, 'verify email')
  const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
  requireStatus(session, 200, 'create session')
  const token = responseData(session).data.accessToken as string
  const headers = {authorization: `Bearer ${token}`}
  const context = {version, hostVersion: '1.1.0', platform: 'ios'}

  const packagePlan = await app.inject({
    method: 'POST',
    url: `/v1/modules/${moduleId}/package-install-plan`,
    headers,
    payload: context,
  })
  requireStatus(packagePlan, 404, 'Vault Notes optional package plan')
  const packagePlanBody = responseData(packagePlan)
  if (packagePlanBody.error?.code !== 'NOT_FOUND') throw new Error('Vault Notes package-plan failure was not NOT_FOUND')

  const install = await app.inject({
    method: 'POST',
    url: `/v1/modules/${moduleId}/install`,
    headers: {...headers, 'idempotency-key': `vault-plan-${suffix}`},
    payload: {...context, approvedPermissions: []},
  })
  requireStatus(install, 202, 'Vault Notes standard install')
  const installBody = responseData(install)
  const descriptor = await app.inject({
    method: 'GET',
    url: `/v1/modules/${moduleId}/installation-descriptor?hostVersion=1.1.0&platform=ios`,
    headers,
  })
  requireStatus(descriptor, 200, 'Vault Notes installation descriptor')
  const descriptorBody = responseData(descriptor)
  if (descriptorBody.data?.currentRelease?.version !== version
    || descriptorBody.data?.currentRelease?.trust?.signatureState !== 'verified') {
    throw new Error('Vault Notes installation descriptor did not preserve the signed 2.0.2 release')
  }

  process.stdout.write(`${JSON.stringify({
    scope: 'qa-disposable',
    moduleId,
    release: {
      releaseId: release.release_id,
      version,
      state: release.release_state,
      sha256: release.release_sha256,
      sourceCommit: release.source_commit,
      signingKeyId: release.signature_key_id,
    },
    packageInstallPlan: {status: packagePlan.statusCode, code: packagePlanBody.error.code},
    standardInstall: {
      status: install.statusCode,
      installationId: installBody.data.installationId,
      distributionReady: installBody.data.distributionReady,
    },
    installationDescriptor: {
      status: descriptor.statusCode,
      version: descriptorBody.data.currentRelease.version,
      signatureState: descriptorBody.data.currentRelease.trust.signatureState,
    },
  }, null, 2)}\n`)
} finally {
  await app.close()
  await db.destroy()
}
