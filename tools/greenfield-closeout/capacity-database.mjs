#!/usr/bin/env node
import {createRequire} from 'node:module'

const require = createRequire(new URL('../../services/greenfield-api/package.json', import.meta.url))
const pg = require('pg')

const connectionString = process.env.MODULA_TEST_DATABASE_URL
if (!connectionString) fail('MODULA_TEST_DATABASE_URL is required')
const parsed = new URL(connectionString)
const databaseName = parsed.pathname.slice(1)
if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) || !/(closeout|test|disposable)/i.test(databaseName)) {
  fail('capacity tooling is restricted to a local disposable database whose name contains closeout, test, or disposable')
}

const mode = process.argv[2] ?? 'audit'
const recordCount = boundedInteger(process.env.MODULA_CAPACITY_RECORDS ?? '100000', 1_000, 1_000_000, 'MODULA_CAPACITY_RECORDS')
const revisionCount = boundedInteger(process.env.MODULA_CAPACITY_REVISIONS ?? '3', 1, 20, 'MODULA_CAPACITY_REVISIONS')
const referenceCount = Math.min(recordCount, boundedInteger(process.env.MODULA_CAPACITY_REFERENCES ?? '50000', 0, 1_000_000, 'MODULA_CAPACITY_REFERENCES'))
const shareCount = Math.min(recordCount, boundedInteger(process.env.MODULA_CAPACITY_SHARES ?? '25000', 0, 1_000_000, 'MODULA_CAPACITY_SHARES'))
const mediaCount = Math.min(recordCount, boundedInteger(process.env.MODULA_CAPACITY_MEDIA ?? '10000', 0, 1_000_000, 'MODULA_CAPACITY_MEDIA'))
const prefix = 'greenfield-closeout-capacity'
const accountId = `${prefix}-owner`
const recipientId = `${prefix}-recipient`
const extensionId = `${prefix}-extension`
const extensionVersionId = `${prefix}-extension-version`
const installationId = `${prefix}-installation`
const moduleId = 'digital.modula.closeout-capacity'
const collection = 'note'
const fixtureTables = [
  'greenfield_module_records', 'greenfield_module_record_revisions', 'greenfield_module_record_changes',
  'greenfield_module_record_mutations', 'greenfield_module_record_references', 'greenfield_module_record_shares',
  'greenfield_module_record_media_bindings', 'attachments', 'search_documents',
]
const client = new pg.Client({connectionString, application_name: `greenfield-closeout-capacity-${mode}`})

await client.connect()
try {
  if (mode === 'seed') await seed()
  else if (mode === 'audit') await audit()
  else if (mode === 'cleanup') await cleanup()
  else fail('mode must be seed, audit, or cleanup')
} finally {
  await client.end()
}

async function seed() {
  const exists = await scalar('SELECT count(*)::int FROM greenfield_accounts WHERE account_id=$1', [accountId])
  if (exists !== 0) fail('capacity fixture already exists; use cleanup or a fresh disposable database')
  const startedAt = new Date().toISOString()
  const databaseBytesBefore = Number(await scalar('SELECT pg_database_size(current_database())::bigint'))
  const walStart = await scalar('SELECT pg_current_wal_lsn()::text')
  const timings = []

  await client.query('BEGIN')
  try {
    await timed(timings, 'parents', async () => {
      await client.query(`
        INSERT INTO greenfield_accounts (account_id,primary_handle,status) VALUES
          ($1,'closeout.capacity.owner','active'),
          ($2,'closeout.capacity.recipient','active')
      `, [accountId, recipientId])
      await client.query(`INSERT INTO greenfield_extensions (extension_id,slug,status) VALUES ($1,$2,'published')`, [extensionId, moduleId])
      await client.query(`
        INSERT INTO greenfield_extension_versions (extension_version_id,extension_id,version,manifest,status)
        VALUES ($1,$2,'1.0.0',$3::jsonb,'published')
      `, [extensionVersionId, extensionId, JSON.stringify({moduleId, version: '1.0.0', fixture: true})])
      await client.query(`
        INSERT INTO greenfield_extension_installations
          (installation_id,extension_version_id,account_id,status,config,update_policy,release_channel)
        VALUES ($1,$2,$3,'enabled','{}'::jsonb,'automaticStable','stable')
      `, [installationId, extensionVersionId, accountId])
    })

    await timed(timings, 'records', () => client.query(`
      INSERT INTO greenfield_module_records (
        record_id,account_id,module_id,installation_id,collection,schema_ref,visibility,
        data,search_text,folder_ref,retained_after_uninstall,revision,created_at,updated_at,deleted_at
      )
      SELECT
        $1 || '-record-' || lpad(gs::text,8,'0'), $2, $3, $4, $5,
        'schema://closeout/note/1.0.0', 'private',
        jsonb_build_object(
          'title',format('Capacity Note %s',gs),
          'body',format('Architecture recovery synchronization capacity fixture %s %s',gs,repeat('bounded ',12)),
          'tags',jsonb_build_array('capacity',CASE WHEN gs%2=0 THEN 'architecture' ELSE 'recovery' END),
          'properties',jsonb_build_object('rank',gs,'reviewed',gs%3=0),
          'folderId',format('folder-%s',gs%100)
        ),
        format('Capacity Note %s architecture recovery synchronization bounded',gs),
        format('folder-%s',gs%100), FALSE, $6,
        now() - (($7-gs)::text || ' milliseconds')::interval,
        now() - (($7-gs)::text || ' milliseconds')::interval,
        NULL
      FROM generate_series(1,$7) gs
    `, [prefix, accountId, moduleId, installationId, collection, revisionCount, recordCount]))

    await timed(timings, 'revisions', () => client.query(`
      INSERT INTO greenfield_module_record_revisions (
        revision_id,account_id,installation_id,module_id,record_type,record_id,revision,
        base_revision,operation,mutation_id,actor_id,data_snapshot,visibility,deleted,payload_hash,created_at
      )
      SELECT
        format('%s-revision-%s-%s',$1::text,lpad(gs::text,8,'0'),revision),
        $2,$3,$4,$5,format('%s-record-%s',$1::text,lpad(gs::text,8,'0')),revision,
        CASE WHEN revision=1 THEN NULL ELSE revision-1 END,
        CASE WHEN revision=1 THEN 'create' ELSE 'update' END,
        format('%s-mutation-%s-%s',$1::text,lpad(gs::text,8,'0'),revision),
        'closeout-capacity-actor',
        jsonb_build_object('title',format('Capacity Note %s',gs),'body',format('revision %s architecture recovery',revision),'revision',revision),
        'private',FALSE,
        encode(sha256(convert_to(format('%s:%s',gs,revision),'UTF8')),'hex'),
        now() - (($6-gs)::text || ' milliseconds')::interval + (revision::text || ' microseconds')::interval
      FROM generate_series(1,$6) gs CROSS JOIN generate_series(1,$7) revision
    `, [prefix, accountId, installationId, moduleId, collection, recordCount, revisionCount]))

    await timed(timings, 'syncChanges', () => client.query(`
      INSERT INTO greenfield_module_record_changes (
        account_id,installation_id,module_id,record_type,record_id,revision,operation,deleted,
        owner_account_id,change_kind,details,created_at
      )
      SELECT
        $1,$2,$3,$4,format('%s-record-%s',$5::text,lpad(gs::text,8,'0')),revision,
        CASE WHEN revision=1 THEN 'create' ELSE 'update' END,FALSE,$1,'record','{}'::jsonb,
        now() - (($6-gs)::text || ' milliseconds')::interval + (revision::text || ' microseconds')::interval
      FROM generate_series(1,$6) gs CROSS JOIN generate_series(1,$7) revision
    `, [accountId, installationId, moduleId, collection, prefix, recordCount, revisionCount]))

    await timed(timings, 'mutations', () => client.query(`
      INSERT INTO greenfield_module_record_mutations (
        mutation_row_id,account_id,installation_id,module_id,mutation_id,operation,
        record_type,record_id,payload_hash,status,result,created_at,completed_at
      )
      SELECT
        format('%s-mutation-row-%s',$1::text,lpad(gs::text,8,'0')),$2,$3,$4,
        format('%s-current-%s',$1::text,lpad(gs::text,8,'0')),'update',$5,
        format('%s-record-%s',$1::text,lpad(gs::text,8,'0')),
        encode(sha256(convert_to(format('mutation:%s',gs),'UTF8')),'hex'),'completed',
        jsonb_build_object('recordId',format('%s-record-%s',$1::text,lpad(gs::text,8,'0')),'revision',$6::int),
        now(),now()
      FROM generate_series(1,$7) gs
    `, [prefix, accountId, installationId, moduleId, collection, revisionCount, recordCount]))

    if (referenceCount > 0) await timed(timings, 'references', () => client.query(`
      INSERT INTO greenfield_module_record_references (
        reference_id,account_id,source_installation_id,source_module_id,source_record_type,
        source_record_id,source_revision,field_path,ordinal,target_module_id,target_record_type,target_record_id,created_at
      )
      SELECT
        format('%s-reference-%s',$1::text,lpad(gs::text,8,'0')),$2,$3,$4,$5,
        format('%s-record-%s',$1::text,lpad(gs::text,8,'0')),$6,'/related/0',0,$4,$5,
        format('%s-record-%s',$1::text,lpad(((gs % $7)+1)::text,8,'0')),now()
      FROM generate_series(1,$8) gs
    `, [prefix, accountId, installationId, moduleId, collection, revisionCount, recordCount, referenceCount]))

    if (shareCount > 0) await timed(timings, 'shares', () => client.query(`
      INSERT INTO greenfield_module_record_shares (
        share_id,owner_account_id,recipient_account_id,source_installation_id,module_id,
        record_type,record_id,permission,mutation_id,payload_hash,created_at,updated_at
      )
      SELECT
        format('%s-share-%s',$1::text,lpad(gs::text,8,'0')),$2,$3,$4,$5,$6,
        format('%s-record-%s',$1::text,lpad(gs::text,8,'0')),
        CASE WHEN gs%4=0 THEN 'edit' ELSE 'read' END,
        format('%s-share-mutation-%s',$1::text,lpad(gs::text,8,'0')),
        encode(sha256(convert_to(format('share:%s',gs),'UTF8')),'hex'),now(),now()
      FROM generate_series(1,$7) gs
    `, [prefix, accountId, recipientId, installationId, moduleId, collection, shareCount]))

    if (mediaCount > 0) await timed(timings, 'media', async () => {
      await client.query(`
        INSERT INTO attachments (
          attachment_id,owner_account_id,kind,mime_type,original_filename,byte_size,
          checksum,storage_key,storage_provider,status,metadata,attached_at,created_at,updated_at
        )
        SELECT
          format('%s-asset-%s',$1::text,lpad(gs::text,8,'0')),$2,
          CASE WHEN gs%3=0 THEN 'pdf' WHEN gs%3=1 THEN 'image' ELSE 'audio' END,
          CASE WHEN gs%3=0 THEN 'application/pdf' WHEN gs%3=1 THEN 'image/png' ELSE 'audio/mpeg' END,
          format('capacity-%s.bin',gs),4096,
          encode(sha256(convert_to(format('asset:%s',gs),'UTF8')),'hex'),
          format('closeout/capacity/%s',gs),'filesystem','ready',
          jsonb_build_object('fixture',true),now(),now(),now()
        FROM generate_series(1,$3) gs
      `, [prefix, accountId, mediaCount])
      await client.query(`
        INSERT INTO greenfield_module_record_media_bindings (
          binding_id,record_owner_account_id,module_id,record_type,record_id,asset_id,
          asset_owner_account_id,source_installation_id,field_path,role,order_index,
          caption,media_type,filename,size,content_type,created_at,updated_at
        )
        SELECT
          format('%s-binding-%s',$1::text,lpad(gs::text,8,'0')),$2,$3,$4,
          format('%s-record-%s',$1::text,lpad(gs::text,8,'0')),
          format('%s-asset-%s',$1::text,lpad(gs::text,8,'0')),$2,$5,'/attachments','attachment',0,
          format('Capacity attachment %s',gs),
          CASE WHEN gs%3=0 THEN 'pdf' WHEN gs%3=1 THEN 'image' ELSE 'audio' END,
          format('capacity-%s.bin',gs),4096,
          CASE WHEN gs%3=0 THEN 'application/pdf' WHEN gs%3=1 THEN 'image/png' ELSE 'audio/mpeg' END,
          now(),now()
        FROM generate_series(1,$6) gs
      `, [prefix, accountId, moduleId, collection, installationId, mediaCount])
    })

    await timed(timings, 'searchProjection', () => client.query(`
      INSERT INTO search_documents (
        document_id,schema_version,entity_type,entity_id,source_version,account_id,owner_id,
        title,body,summary,keywords,tags,visibility,status,language,metadata,
        created_at,updated_at,indexed_at,search_vector
      )
      SELECT
        format('%s-search-%s',$1::text,lpad(gs::text,8,'0')),'1.0.0','module-record',
        rtrim(translate(replace(encode(convert_to(format('["%s","%s","%s","%s-record-%s"]',$2::text,$3::text,$4::text,$1::text,lpad(gs::text,8,'0')),'UTF8'),'base64'),E'\n',''),'+/','-_'),'='),
        $5,$2,$2,format('Capacity Note %s',gs),
        format('architecture recovery synchronization capacity fixture %s',gs),NULL,
        ARRAY['capacity','architecture'],ARRAY['capacity',CASE WHEN gs%2=0 THEN 'architecture' ELSE 'recovery' END],
        'account','active','en',jsonb_build_object('fixture',true,'moduleId',$3,'recordType',$4),
        now(),now(),now(),
        to_tsvector('simple',format('Capacity Note %s architecture recovery synchronization',gs))
      FROM generate_series(1,$6) gs
    `, [prefix, accountId, moduleId, collection, revisionCount, recordCount]))

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }

  await timed(timings, 'analyze', () => client.query(`ANALYZE
    greenfield_module_records,
    greenfield_module_record_revisions,
    greenfield_module_record_changes,
    greenfield_module_record_mutations,
    greenfield_module_record_references,
    greenfield_module_record_shares,
    greenfield_module_record_media_bindings,
    search_documents`))
  const walEnd = await scalar('SELECT pg_current_wal_lsn()::text')
  const walBytes = Number(await scalar('SELECT pg_wal_lsn_diff($1::pg_lsn,$2::pg_lsn)::bigint', [walEnd, walStart]))
  const databaseBytesAfter = Number(await scalar('SELECT pg_database_size(current_database())::bigint'))
  const counts = await fixtureCounts()
  output({
    format: 'modula.greenfield.capacity-fixture.v1', mode: 'seed', result: 'PASS', database: databaseName,
    startedAt, completedAt: new Date().toISOString(), requested: {recordCount, revisionCount, referenceCount, shareCount, mediaCount},
    counts, timings, databaseBytesBefore, databaseBytesAfter, databaseGrowthBytes: databaseBytesAfter - databaseBytesBefore,
    walStart, walEnd, walBytes,
  })
}

async function audit() {
  const counts = await fixtureCounts()
  if (counts.records < 1) fail('capacity fixture is absent; run seed first')
  const plans = []
  plans.push(await explain('records', `
    SELECT record_id,revision,updated_at FROM greenfield_module_records
    WHERE account_id=$1 AND module_id=$2 AND collection=$3 AND deleted_at IS NULL
    ORDER BY updated_at DESC LIMIT 50`, [accountId, moduleId, collection]))
  plans.push(await explain('history', `
    SELECT revision,operation,created_at FROM greenfield_module_record_revisions
    WHERE account_id=$1 AND module_id=$2 AND record_type=$3 AND record_id=$4
    ORDER BY revision DESC LIMIT 100`, [accountId, moduleId, collection, recordId(Math.ceil(counts.records / 2))]))
  plans.push(await explain('reverseReferences', `
    SELECT source_record_id,field_path FROM greenfield_module_record_references
    WHERE account_id=$1 AND target_module_id=$2 AND target_record_type=$3 AND target_record_id=$4
    ORDER BY field_path LIMIT 100`, [accountId, moduleId, collection, recordId(2)]))
  const middleSequence = Number(await scalar(`
    SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY change_sequence)::bigint
    FROM greenfield_module_record_changes WHERE account_id=$1 AND installation_id=$2 AND module_id=$3
  `, [accountId, installationId, moduleId]))
  plans.push(await explain('sync', `
    SELECT change_sequence,record_id,revision,operation FROM greenfield_module_record_changes
    WHERE account_id=$1 AND installation_id=$2 AND module_id=$3 AND change_sequence>$4
    ORDER BY change_sequence LIMIT 200`, [accountId, installationId, moduleId, middleSequence]))
  plans.push(await explain('shares', `
    SELECT share_id,record_id,permission FROM greenfield_module_record_shares
    WHERE recipient_account_id=$1 AND module_id=$2 AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at>now())
    ORDER BY created_at DESC LIMIT 100`, [recipientId, moduleId]))
  plans.push(await explain('search', `
    SELECT document_id,title FROM search_documents
    WHERE entity_type='module-record' AND account_id=$1 AND status='active'
      AND search_vector @@ plainto_tsquery('simple',$2)
    ORDER BY updated_at DESC LIMIT 50`, [accountId, 'architecture']))
  plans.push(await explain('mutationReplay', `
    SELECT payload_hash,status,result FROM greenfield_module_record_mutations
    WHERE account_id=$1 AND installation_id=$2 AND mutation_id=$3`, [accountId, installationId, `${prefix}-current-${String(Math.ceil(counts.records / 2)).padStart(8, '0')}`]))

  const integrity = await client.query(`
    SELECT
      (SELECT count(*) FROM greenfield_module_records r LEFT JOIN greenfield_module_record_revisions rv
        ON rv.account_id=r.account_id AND rv.module_id=r.module_id AND rv.record_type=r.collection
        AND rv.record_id=r.record_id AND rv.revision=r.revision
        WHERE r.account_id=$1 AND rv.revision_id IS NULL)::int AS latest_revision_mismatch,
      (SELECT count(*) FROM (
        SELECT revision,lag(revision) OVER (PARTITION BY account_id,module_id,record_type,record_id ORDER BY revision) previous
        FROM greenfield_module_record_revisions WHERE account_id=$1
      ) ordered WHERE previous IS NOT NULL AND revision<>previous+1)::int AS revision_gap,
      (SELECT count(*) FROM greenfield_module_record_changes c
        WHERE c.account_id=$1 GROUP BY change_sequence HAVING count(*)>1 LIMIT 1)::int AS duplicate_sync_sequence,
      (SELECT count(*) FROM greenfield_module_record_references ref
        LEFT JOIN greenfield_module_records target ON target.account_id=ref.account_id
          AND target.module_id=ref.target_module_id AND target.collection=ref.target_record_type
          AND target.record_id=ref.target_record_id
        WHERE ref.account_id=$1 AND target.record_id IS NULL)::int AS orphan_reference
  `, [accountId])

  const tables = await client.query(`
    SELECT relname AS table_name,n_live_tup,n_dead_tup,last_autovacuum,last_autoanalyze,
      pg_total_relation_size(relid)::bigint AS total_bytes
    FROM pg_stat_user_tables
    WHERE relname = ANY($1::text[])
    ORDER BY pg_total_relation_size(relid) DESC
  `, [fixtureTables])
  const indexes = await client.query(`
    SELECT relname AS table_name,indexrelname AS index_name,idx_scan,
      pg_relation_size(indexrelid)::bigint AS index_bytes
    FROM pg_stat_user_indexes
    WHERE relname = ANY($1::text[])
    ORDER BY relname,indexrelname
  `, [fixtureTables])
  const connections = await client.query(`
    SELECT count(*)::int AS current_connections,
      current_setting('max_connections')::int AS max_connections
    FROM pg_stat_activity WHERE datname=current_database()
  `)

  const invariant = integrity.rows[0]
  const failures = Object.entries(invariant).filter(([, value]) => Number(value ?? 0) !== 0)
  output({
    format: 'modula.greenfield.capacity-audit.v1', mode: 'audit', result: failures.length ? 'FAIL' : 'PASS',
    database: databaseName, generatedAt: new Date().toISOString(), counts, plans,
    integrity: invariant, tables: tables.rows, indexes: indexes.rows, connections: connections.rows[0],
  })
  if (failures.length) process.exitCode = 1
}

async function cleanup() {
  const before = await fixtureCounts()
  await client.query('BEGIN')
  try {
    await client.query(`DELETE FROM search_documents WHERE document_id LIKE $1`, [`${prefix}-search-%`])
    await client.query(`DELETE FROM greenfield_module_record_media_bindings WHERE binding_id LIKE $1`, [`${prefix}-binding-%`])
    await client.query(`DELETE FROM greenfield_module_record_shares WHERE share_id LIKE $1`, [`${prefix}-share-%`])
    await client.query(`DELETE FROM greenfield_module_record_references WHERE reference_id LIKE $1`, [`${prefix}-reference-%`])
    await client.query(`DELETE FROM greenfield_module_records WHERE account_id=$1`, [accountId])
    await client.query(`DELETE FROM greenfield_extension_installations WHERE installation_id=$1`, [installationId])
    await client.query(`DELETE FROM greenfield_accounts WHERE account_id IN ($1,$2)`, [accountId, recipientId])
    await client.query(`DELETE FROM greenfield_extension_versions WHERE extension_version_id=$1`, [extensionVersionId])
    await client.query(`DELETE FROM greenfield_extensions WHERE extension_id=$1`, [extensionId])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
  const after = await fixtureCounts()
  output({format: 'modula.greenfield.capacity-fixture.v1', mode: 'cleanup', result: Object.values(after).every(value => value === 0) ? 'PASS' : 'FAIL', before, after})
  if (Object.values(after).some(value => value !== 0)) process.exitCode = 1
}

async function fixtureCounts() {
  const result = await client.query(`
    SELECT
      (SELECT count(*) FROM greenfield_module_records WHERE account_id=$1)::int AS records,
      (SELECT count(*) FROM greenfield_module_record_revisions WHERE account_id=$1)::int AS revisions,
      (SELECT count(*) FROM greenfield_module_record_changes WHERE account_id=$1)::int AS sync_changes,
      (SELECT count(*) FROM greenfield_module_record_mutations WHERE account_id=$1)::int AS mutations,
      (SELECT count(*) FROM greenfield_module_record_references WHERE account_id=$1)::int AS references,
      (SELECT count(*) FROM greenfield_module_record_shares WHERE owner_account_id=$1)::int AS shares,
      (SELECT count(*) FROM greenfield_module_record_media_bindings WHERE record_owner_account_id=$1)::int AS media_bindings,
      (SELECT count(*) FROM attachments WHERE owner_account_id=$1)::int AS attachments,
      (SELECT count(*) FROM search_documents WHERE document_id LIKE $2)::int AS search_documents
  `, [accountId, `${prefix}-search-%`])
  return Object.fromEntries(Object.entries(result.rows[0]).map(([key, value]) => [camel(key), Number(value)]))
}

async function explain(name, query, parameters) {
  const result = await client.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${query}`, parameters)
  const root = result.rows[0]['QUERY PLAN'][0]
  const nodes = []
  visitPlan(root.Plan, nodes)
  return {
    name,
    planningMs: number(root['Planning Time']),
    executionMs: number(root['Execution Time']),
    root: root.Plan['Node Type'],
    nodes: [...new Set(nodes)],
    rows: Number(root.Plan['Actual Rows'] ?? 0),
    sharedHitBlocks: sumPlan(root.Plan, 'Shared Hit Blocks'),
    sharedReadBlocks: sumPlan(root.Plan, 'Shared Read Blocks'),
  }
}

function visitPlan(plan, nodes) {
  const relation = plan['Relation Name'] ? ` ${plan['Relation Name']}` : ''
  const index = plan['Index Name'] ? ` via ${plan['Index Name']}` : ''
  nodes.push(`${plan['Node Type']}${relation}${index}`)
  for (const child of plan.Plans ?? []) visitPlan(child, nodes)
}

function sumPlan(plan, field) {
  return Number(plan[field] ?? 0) + (plan.Plans ?? []).reduce((sum, child) => sum + sumPlan(child, field), 0)
}

async function scalar(query, parameters = []) {
  const result = await client.query(query, parameters)
  return Object.values(result.rows[0] ?? {})[0]
}

async function timed(timings, name, operation) {
  const started = performance.now()
  await operation()
  timings.push({name, milliseconds: Math.round(performance.now() - started)})
}

function recordId(value) {
  return `${prefix}-record-${String(value).padStart(8, '0')}`
}

function boundedInteger(value, minimum, maximum, name) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) fail(`${name} must be an integer between ${minimum} and ${maximum}`)
  return parsed
}

function camel(value) {
  return value.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase())
}

function number(value) {
  return Number(Number(value ?? 0).toFixed(3))
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function fail(message) {
  throw new Error(message)
}
