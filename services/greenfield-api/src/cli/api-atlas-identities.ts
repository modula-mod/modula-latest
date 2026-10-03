import {sql} from 'kysely'
import {AccountService} from '../accounts/service.js'
import {loadConfig} from '../config/index.js'
import {createDb} from '../database/client.js'
import {verifyPassword} from '../lib/password.js'

const MARKER = 'modula-api-atlas-production-audit-v1'
const ALLOWED_HANDLES = new Set(['api-atlas-a', 'api-atlas-b'])

type IdentitySpec = {
  handle: 'api-atlas-a' | 'api-atlas-b'
  displayName: string
  email: string
  password: string
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function specs(): IdentitySpec[] {
  return [
    {
      handle: 'api-atlas-a',
      displayName: 'API Atlas Audit A',
      email: process.env.API_ATLAS_A_EMAIL?.trim().toLowerCase() ?? 'api-atlas-a@audit.invalid',
      password: required('API_ATLAS_A_PASSWORD'),
    },
    {
      handle: 'api-atlas-b',
      displayName: 'API Atlas Audit B',
      email: process.env.API_ATLAS_B_EMAIL?.trim().toLowerCase() ?? 'api-atlas-b@audit.invalid',
      password: required('API_ATLAS_B_PASSWORD'),
    },
  ]
}

async function provision(spec: IdentitySpec) {
  if (!ALLOWED_HANDLES.has(spec.handle)) throw new Error(`Refusing unreserved audit handle ${spec.handle}`)
  const config = loadConfig()
  const db = createDb(config.databaseUrl)
  try {
    const existing = await db
      .selectFrom('greenfield_auth_identities as identity')
      .innerJoin('greenfield_accounts as account', 'account.account_id', 'identity.account_id')
      .innerJoin('greenfield_password_credentials as password', 'password.account_id', 'identity.account_id')
      .select([
        'identity.account_id',
        'identity.metadata',
        'account.primary_handle',
        'account.status',
        'password.password_hash',
      ])
      .where('identity.kind', '=', 'email')
      .where('identity.identifier', '=', spec.email)
      .executeTakeFirst()

    let accountId: string
    let created = false
    if (existing) {
      const metadata = existing.metadata as {auditFixture?: {marker?: unknown}} | null
      if (
        existing.primary_handle !== spec.handle ||
        metadata?.auditFixture?.marker !== MARKER ||
        existing.status !== 'active'
      ) {
        throw new Error(`Refusing collision with non-audit identity ${spec.handle}`)
      }
      if (!(await verifyPassword(spec.password, existing.password_hash))) {
        throw new Error(`Stored password does not match the secured audit secret for ${spec.handle}`)
      }
      accountId = existing.account_id
    } else {
      // The production AccountService intentionally never returns a verification
      // token. This guarded CLI uses the same service in development-token mode,
      // then activates without provisioning a real mailbox.
      const accounts = new AccountService(db, {...config, environment: 'development'}, undefined)
      const registration = await accounts.register({
        email: spec.email,
        password: spec.password,
        handle: spec.handle,
        displayName: spec.displayName,
        acceptedTerms: true,
        correlationId: `api-atlas:${spec.handle}`,
      })
      if (!registration.verificationToken) throw new Error(`Audit verification token missing for ${spec.handle}`)
      await accounts.verifyEmail(registration.verificationToken, {provisionMailIdentity: false})
      accountId = registration.accountId
      created = true
    }

    const identity = await db
      .selectFrom('greenfield_auth_identities')
      .select('metadata')
      .where('account_id', '=', accountId)
      .where('kind', '=', 'email')
      .executeTakeFirstOrThrow()
    const currentMetadata = identity.metadata && typeof identity.metadata === 'object' && !Array.isArray(identity.metadata)
      ? identity.metadata as Record<string, unknown>
      : {}
    const metadata = {
      ...currentMetadata,
      displayName: spec.displayName,
      auditFixture: {
        marker: MARKER,
        reserved: true,
        realPerson: false,
        mailProvisioning: false,
        discovery: false,
      },
    }
    await db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_auth_identities')
        .set({metadata: sql`${JSON.stringify(metadata)}::jsonb`, updated_at: new Date()})
        .where('account_id', '=', accountId)
        .where('kind', '=', 'email')
        .execute()
      await trx
        .updateTable('profiles')
        .set({visibility: 'private', display_name: spec.displayName, updated_at: new Date()})
        .where('actor_id', '=', `actor-${accountId}`)
        .execute()
    })
    return {handle: spec.handle, accountId, created, marker: MARKER, visibility: 'private', mailProvisioning: false}
  } finally {
    await db.destroy()
  }
}

async function main() {
  if (process.env.API_ATLAS_IDENTITY_BOOTSTRAP !== 'I_UNDERSTAND_THIS_CREATES_RESERVED_PRODUCTION_AUDIT_IDENTITIES') {
    throw new Error('Set API_ATLAS_IDENTITY_BOOTSTRAP to the exact documented guard value')
  }
  const result = []
  for (const spec of specs()) result.push(await provision(spec))
  process.stdout.write(`${JSON.stringify({marker: MARKER, identities: result}, null, 2)}\n`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
