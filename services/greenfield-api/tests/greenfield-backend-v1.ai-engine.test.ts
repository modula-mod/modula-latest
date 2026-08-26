import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Greenfield Backend V1 AI engine ledger', () => {
  let db: ModulaDb

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
  })

  afterAll(async () => {
    await db?.destroy()
  })

  it('registers provider-neutral Gemini while keeping every new model disabled', async () => {
    const provider = await db
      .selectFrom('greenfield_ai_providers')
      .select(['provider_id', 'provider_kind', 'status', 'configuration_mode', 'metadata'])
      .where('provider_id', '=', 'provider:gemini')
      .executeTakeFirstOrThrow()
    expect(provider).toMatchObject({provider_id: 'provider:gemini', provider_kind: 'google', status: 'unconfigured', configuration_mode: 'platform-managed'})
    expect(provider.metadata).toMatchObject({managedBy: 'modula-ai-backend', executionService: 'service.modula-ai', credentialSource: 'modula-secrets-service'})
    expect(JSON.stringify(provider.metadata)).not.toMatch(/api.?key|credentialValue|Bearer /i)

    const model = await db
      .selectFrom('greenfield_ai_models')
      .select(['model_id', 'provider_id', 'availability', 'enabled', 'supports_embeddings', 'supports_structured_outputs'])
      .where('model_id', '=', 'greenfield.gemini.general')
      .executeTakeFirstOrThrow()
    expect(model).toEqual({
      model_id: 'greenfield.gemini.general', provider_id: 'provider:gemini', availability: 'unavailable', enabled: false,
      supports_embeddings: true, supports_structured_outputs: true,
    })
  })

  it('projects existing providers through service.modula-ai without storing provider credentials', async () => {
    const providers = await db
      .selectFrom('greenfield_ai_providers')
      .select(['provider_id', 'status', 'metadata'])
      .where('provider_id', 'in', ['provider:openai', 'provider:anthropic', 'provider:local', 'provider:ollama'])
      .orderBy('provider_id')
      .execute()
    expect(providers).toHaveLength(4)
    expect(providers.every(provider => provider.metadata && (provider.metadata as Record<string, unknown>).executionService === 'service.modula-ai')).toBe(true)
    expect(providers.every(provider => provider.status !== 'available')).toBe(true)
  })

  it('retains API and worker read access after the migration', async () => {
    const privileges = await sql<{api: boolean; worker: boolean}>`
      SELECT
        has_table_privilege('modula_api', 'greenfield_ai_providers', 'SELECT') AS api,
        has_table_privilege('modula_worker', 'greenfield_ai_models', 'SELECT') AS worker
    `.execute(db)
    expect(privileges.rows[0]).toEqual({api: true, worker: true})
  })
})
