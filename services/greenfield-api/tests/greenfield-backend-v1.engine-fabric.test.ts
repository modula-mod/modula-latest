import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {createServer} from '../src/app/create-server.js'
import {loadConfig} from '../src/config/env.js'
import {migrateUp} from '../src/database/migrate.js'
import {GreenfieldEngineRegistryService} from '../src/domains/engines/service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Greenfield Backend V1 trusted engine fabric', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4052'
    process.env.MODULA_PUBLIC_API_URL = 'https://api.test.modula.digital'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await app.ready()
  })

  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })

  it('projects ten exact-provenance engines with truthful runtime states', async () => {
    const engines = await new GreenfieldEngineRegistryService(db).list()
    expect(engines).toHaveLength(10)
    expect(engines.filter(engine => engine.runtimeStatus === 'READY').map(engine => engine.engineId).sort()).toEqual([
      'engine.ai', 'engine.media', 'engine.notifications', 'engine.search',
    ])
    expect(engines.filter(engine => engine.runtimeStatus === 'CONTRACT_ONLY')).toHaveLength(6)
    expect(engines.every(engine => engine.source.repository === 'modula-mod/modula-backend-engines')).toBe(true)
    expect(new Set(engines.map(engine => engine.source.revision))).toEqual(new Set(['a5511d3065326e5b29f0ab786a6975921b9db286']))
    expect(engines.filter(engine => engine.runtimeStatus === 'CONTRACT_ONLY').every(engine => engine.services.length === 0)).toBe(true)
  })

  it('publishes a secret-free public topology and protects full declarations with admin capability', async () => {
    const meta = await app.inject({method: 'GET', url: '/v1/meta'})
    expect(meta.statusCode, meta.body).toBe(200)
    expect(meta.json().data.engines).toHaveLength(10)
    expect(meta.body).not.toMatch(/secret:\/\/|credential|api.?key|Bearer /i)
    const admin = await app.inject({method: 'GET', url: '/v1/admin/ops/engines'})
    expect(admin.statusCode).toBe(401)
  })

  it('rejects active services for contract-only engines and grants ledger-only backup access', async () => {
    await expect(sql`
      INSERT INTO greenfield_engine_service_registrations
        (engine_id, service_id, execution_mode, audience, protocol_version, actions, required_capabilities, health_path, timeout_ms, tls_required)
      VALUES
        ('engine.files','service.invalid-files','IN_PROCESS','modula-engine:files','1.0.0','["files.read"]'::jsonb,'[]'::jsonb,'/v1/health/ready',30000,FALSE)
    `.execute(db)).rejects.toThrow(/only READY trusted engines/)
    await expect(sql`
      INSERT INTO greenfield_engine_job_registrations
        (engine_id, action, version, timeout_seconds, maximum_attempts, active)
      VALUES ('engine.files','files.invalid.v1',1,30,1,TRUE)
    `.execute(db)).rejects.toThrow(/only READY trusted engines/)

    const checks = await sql<{backup: boolean; invalid_active_jobs: string; contract_services: string}>`
      SELECT
        has_table_privilege('modula_backup', 'greenfield_engine_registrations', 'SELECT') AS backup,
        (SELECT count(*)::text FROM greenfield_engine_job_registrations job JOIN greenfield_engine_registrations engine USING (engine_id) WHERE job.active AND engine.runtime_status <> 'READY') AS invalid_active_jobs,
        (SELECT count(*)::text FROM greenfield_engine_service_registrations service JOIN greenfield_engine_registrations engine USING (engine_id) WHERE engine.runtime_status = 'CONTRACT_ONLY') AS contract_services
    `.execute(db)
    expect(checks.rows[0]).toEqual({backup: true, invalid_active_jobs: '0', contract_services: '0'})
  })
})
