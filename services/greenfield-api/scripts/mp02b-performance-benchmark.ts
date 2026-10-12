/**
 * Disposable MP02B query benchmark. It intentionally uses an isolated schema
 * and refuses every database except the documented local benchmark target.
 */
import pg from 'pg'

const url = process.env.MODULA_TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:55432/mp02b_integration'
const allowed = 'postgresql://postgres@127.0.0.1:55432/mp02b_integration'
if (url !== allowed) throw new Error(`Refusing benchmark database ${url}; use ${allowed}`)

const client = new pg.Client({connectionString: url, application_name: 'mp02b-performance-benchmark'})
const schema = `mp02b_perf_${Date.now().toString(36)}`
const q = (name: string) => `"${schema}"."${name}"`
const samples = Number(process.env.MP02B_BENCHMARK_SAMPLES ?? 15)
const records = Number(process.env.MP02B_BENCHMARK_RECORDS ?? 10000)
const revisionsPerRecord = Number(process.env.MP02B_BENCHMARK_REVISIONS ?? 5)

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
}
async function timed(name: string, statement: string, params: unknown[] = []) {
  const values: number[] = []
  for (let i = 0; i < samples; i++) {
    const started = process.hrtime.bigint()
    await client.query(statement, params)
    values.push(Number(process.hrtime.bigint() - started) / 1e6)
  }
  return {name, medianMs: percentile(values, .5), p95Ms: percentile(values, .95), samples}
}

await client.connect()
try {
  await client.query(`CREATE SCHEMA ${JSON.stringify(schema)}`)
  await client.query(`
    CREATE TABLE ${q('records')} (account_id text NOT NULL, module_id text NOT NULL, record_type text NOT NULL, record_id text NOT NULL, search_text text NOT NULL, deleted boolean NOT NULL DEFAULT false, revision integer NOT NULL, data jsonb NOT NULL, PRIMARY KEY(account_id,module_id,record_type,record_id));
    CREATE INDEX records_list ON ${q('records')}(account_id,module_id,record_type,record_id);
    CREATE INDEX records_search ON ${q('records')} USING gin(to_tsvector('simple',search_text));
    CREATE TABLE ${q('revisions')} (account_id text NOT NULL, module_id text NOT NULL, record_type text NOT NULL, record_id text NOT NULL, revision integer NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL, PRIMARY KEY(account_id,module_id,record_type,record_id,revision));
    CREATE INDEX revisions_list ON ${q('revisions')}(account_id,module_id,record_type,record_id,revision DESC);
    CREATE TABLE ${q('refs')} (account_id text NOT NULL, source_module text NOT NULL, source_type text NOT NULL, source_id text NOT NULL, target_module text NOT NULL, target_type text NOT NULL, target_id text NOT NULL, field_path text NOT NULL);
    CREATE INDEX refs_reverse ON ${q('refs')}(account_id,target_module,target_type,target_id);
    CREATE TABLE ${q('changes')} (seq bigserial PRIMARY KEY, account_id text NOT NULL, installation_id text NOT NULL, module_id text NOT NULL, record_type text NOT NULL, record_id text NOT NULL, revision integer NOT NULL, deleted boolean NOT NULL DEFAULT false);
    CREATE INDEX changes_sync ON ${q('changes')}(account_id,installation_id,module_id,seq);
    CREATE TABLE ${q('media')} (account_id text NOT NULL, module_id text NOT NULL, record_type text NOT NULL, record_id text NOT NULL, binding_id text NOT NULL, asset_id text NOT NULL, order_index integer NOT NULL, PRIMARY KEY(account_id,module_id,record_type,record_id,binding_id));
    CREATE INDEX media_list ON ${q('media')}(account_id,module_id,record_type,record_id,order_index);
    CREATE TABLE ${q('shares')} (owner_account text NOT NULL, recipient_account text NOT NULL, module_id text NOT NULL, record_type text NOT NULL, record_id text NOT NULL, revoked boolean NOT NULL DEFAULT false, expires_at timestamptz);
    CREATE INDEX shares_access ON ${q('shares')}(recipient_account,module_id,record_type,record_id,revoked,expires_at);
    CREATE TABLE ${q('functions')} (module_id text NOT NULL, function_id text NOT NULL, version text NOT NULL, enabled boolean NOT NULL, PRIMARY KEY(module_id,function_id,version));
    CREATE TABLE ${q('actions')} (source_module text NOT NULL, target_module text NOT NULL, action_id text NOT NULL, version text NOT NULL, enabled boolean NOT NULL, PRIMARY KEY(source_module,target_module,action_id,version));
  `)
  await client.query(`INSERT INTO ${q('records')} SELECT 'acct-alpha','audit.module.alpha','note', 'r-'||g, 'alpha searchable record '||g, false, ${revisionsPerRecord}, jsonb_build_object('title','Record '||g) FROM generate_series(1,$1) AS s(g)`, [records])
  await client.query(`INSERT INTO ${q('revisions')} SELECT 'acct-alpha','audit.module.alpha','note','r-'||r, v, jsonb_build_object('title','Record '||r||' revision '||v), now() - (v||' minutes')::interval FROM generate_series(1,$1) AS rs(r) CROSS JOIN generate_series(1,$2) AS vs(v)`, [records, revisionsPerRecord])
  await client.query(`INSERT INTO ${q('refs')} SELECT 'acct-alpha','audit.module.alpha','note','r-'||g,'audit.module.alpha','note','r-'||(((g*17)%$1)+1),'body.related' FROM generate_series(1,$1) AS s(g)`, [records])
  await client.query(`INSERT INTO ${q('changes')} (account_id,installation_id,module_id,record_type,record_id,revision) SELECT 'acct-alpha','install-alpha','audit.module.alpha','note','r-'||g,${revisionsPerRecord} FROM generate_series(1,$1) AS s(g)`, [records])
  await client.query(`INSERT INTO ${q('media')} SELECT 'acct-alpha','audit.module.alpha','note','r-'||g,'b-'||g,'asset-'||g,0 FROM generate_series(1,$1) AS s(g)`, [Math.min(records, 5000)])
  await client.query(`INSERT INTO ${q('shares')} SELECT 'acct-alpha','acct-beta','audit.module.alpha','note','r-'||g,false,null FROM generate_series(1,$1) AS s(g)`, [Math.min(records, 5000)])
  await client.query(`INSERT INTO ${q('functions')} VALUES ('audit.module.alpha','echo','1.0.0',true)`)
  await client.query(`INSERT INTO ${q('actions')} VALUES ('audit.module.alpha','audit.module.beta','create','1.0.0',true)`)
  await client.query(`ANALYZE ${q('records')}; ANALYZE ${q('revisions')}; ANALYZE ${q('refs')}; ANALYZE ${q('changes')}; ANALYZE ${q('media')}; ANALYZE ${q('shares')}`)

  const results = []
  results.push(await timed('record list', `SELECT * FROM ${q('records')} WHERE account_id='acct-alpha' AND module_id='audit.module.alpha' AND record_type='note' ORDER BY record_id LIMIT 100`))
  results.push(await timed('reverse refs', `SELECT * FROM ${q('refs')} WHERE account_id='acct-alpha' AND target_module='audit.module.alpha' AND target_type='note' AND target_id='r-5000' LIMIT 100`))
  results.push(await timed('history list', `SELECT * FROM ${q('revisions')} WHERE account_id='acct-alpha' AND module_id='audit.module.alpha' AND record_type='note' AND record_id='r-5000' ORDER BY revision DESC`))
  results.push(await timed('sync initial', `SELECT * FROM ${q('changes')} WHERE account_id='acct-alpha' AND installation_id='install-alpha' AND module_id='audit.module.alpha' AND seq > 0 ORDER BY seq LIMIT 100`))
  results.push(await timed('sync incremental', `SELECT * FROM ${q('changes')} WHERE account_id='acct-alpha' AND installation_id='install-alpha' AND module_id='audit.module.alpha' AND seq > $1 ORDER BY seq LIMIT 100`, [records - 100]))
  results.push(await timed('media binding list', `SELECT * FROM ${q('media')} WHERE account_id='acct-alpha' AND module_id='audit.module.alpha' AND record_type='note' AND record_id='r-5000' ORDER BY order_index`))
  results.push(await timed('sharing access evaluation', `SELECT 1 FROM ${q('shares')} WHERE recipient_account='acct-beta' AND module_id='audit.module.alpha' AND record_type='note' AND record_id='r-5000' AND revoked=false AND (expires_at IS NULL OR expires_at>now())`))
  results.push(await timed('governed function overhead', `SELECT * FROM ${q('functions')} WHERE module_id='audit.module.alpha' AND function_id='echo' AND version='1.0.0' AND enabled=true`))
  results.push(await timed('inter-module action overhead', `SELECT * FROM ${q('actions')} WHERE source_module='audit.module.alpha' AND target_module='audit.module.beta' AND action_id='create' AND version='1.0.0' AND enabled=true`))
  results.push(await timed('search', `SELECT record_id FROM ${q('records')} WHERE account_id='acct-alpha' AND module_id='audit.module.alpha' AND to_tsvector('simple',search_text) @@ plainto_tsquery('simple','searchable record') LIMIT 20`))
  console.log(JSON.stringify({schema, records, revisions: records * revisionsPerRecord, references: records, syncChanges: records, media: Math.min(records, 5000), shares: Math.min(records, 5000), results}, null, 2))
} finally {
  await client.query(`DROP SCHEMA IF EXISTS ${JSON.stringify(schema)} CASCADE`).catch(() => undefined)
  await client.end()
}
