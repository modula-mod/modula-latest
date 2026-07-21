#!/usr/bin/env node
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'

const requireFromApi = createRequire(new URL('../../services/greenfield-api/package.json', import.meta.url))
const {Pool} = requireFromApi('pg')

loadEnvFile(resolve('services/greenfield-api/.env'))
const args = parseArgs(process.argv.slice(2))
if (!args.module || !args.version) usage()
const pool = new Pool({connectionString: process.env.MODULA_DATABASE_MIGRATOR_URL || process.env.MODULA_DATABASE_URL, max: 1, application_name: 'modula-registry-publish'})
try {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const release = await client.query(
      `SELECT r.*, v.manifest FROM greenfield_module_releases r JOIN greenfield_module_versions v ON v.module_version_id=r.module_version_id WHERE r.module_id=$1 AND r.version=$2`,
      [args.module, args.version],
    )
    if (release.rowCount !== 1) fail('Release not found')
    const row = release.rows[0]
    if (!['verified', 'pendingReview'].includes(row.release_state)) fail(`Cannot publish release from ${row.release_state}`)
    const manifest = row.manifest
    await client.query(`UPDATE greenfield_module_releases SET release_state='published', published_at=NOW(), updated_at=NOW() WHERE release_id=$1`, [row.release_id])
    await client.query(`UPDATE greenfield_module_versions SET status='published', updated_at=NOW() WHERE module_id=$1 AND version=$2`, [args.module, args.version])
    await client.query(`UPDATE greenfield_extension_versions SET status='published' WHERE extension_version_id=$1`, [row.extension_version_id])
    await client.query(`UPDATE greenfield_extensions SET status='published', updated_at=NOW() WHERE extension_id=$1`, [row.extension_id])
    await client.query(
      `INSERT INTO greenfield_extension_catalogue (extension_id,slug,kind,name,description,version,publisher,trust,permissions,compatibility,manifest,catalogue_status,executable,created_at,updated_at)
       VALUES ($1,$1,'module',$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,NOW(),NOW())
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, version=EXCLUDED.version, publisher=EXCLUDED.publisher, trust=EXCLUDED.trust, permissions=EXCLUDED.permissions, compatibility=EXCLUDED.compatibility, manifest=EXCLUDED.manifest, catalogue_status='active', executable=EXCLUDED.executable, updated_at=NOW()`,
      [
        args.module,
        manifest.name,
        manifest.description,
        args.version,
        manifest.publisher.displayName,
        manifest.trust.requestedLevel,
        JSON.stringify(manifest.permissions),
        JSON.stringify(manifest.compatibility),
        JSON.stringify(manifest),
        manifest.lifecycle?.executionMode !== 'declarative' && manifest.trust.requestedLevel === 'firstParty',
      ],
    )
    await client.query('COMMIT')
    console.log(`module: ${args.module}`)
    console.log(`version: ${args.version}`)
    console.log('release status: published')
    console.log('catalogue status: available')
    console.log('installation mode: declarative')
    console.log('executable functions: disabled until handlers exist')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
} finally {
  await pool.end()
}

function loadEnvFile(file) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const index = trimmed.indexOf('=')
      const key = trimmed.slice(0, index)
      const value = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {}
}
function parseArgs(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) if (argv[index]?.startsWith('--')) parsed[argv[index].slice(2)] = argv[index + 1]
  return parsed
}
function usage() {
  console.error('Usage: pnpm registry:publish-release --module digital.modula.vault-notes --version 0.1.0')
  process.exit(2)
}
function fail(message) {
  console.error(message)
  process.exit(1)
}
