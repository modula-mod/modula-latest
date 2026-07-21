#!/usr/bin/env node
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'

const requireFromApi = createRequire(new URL('../../services/greenfield-api/package.json', import.meta.url))
const {Pool} = requireFromApi('pg')

loadEnvFile(resolve('services/greenfield-api/.env'))
const args = parseArgs(process.argv.slice(2))
if (!args.module || !args.version) usage()
const pool = new Pool({connectionString: process.env.MODULA_DATABASE_MIGRATOR_URL || process.env.MODULA_DATABASE_URL, max: 1, application_name: 'modula-registry-verify'})
try {
  const release = await pool.query(
    `SELECT r.release_id, r.module_id, r.version, r.manifest_sha256, v.manifest
     FROM greenfield_module_releases r
     JOIN greenfield_module_versions v ON v.module_version_id=r.module_version_id
     WHERE r.module_id=$1 AND r.version=$2`,
    [args.module, args.version],
  )
  if (release.rowCount !== 1) fail('Release not found')
  const row = release.rows[0]
  if (row.manifest?.integrity?.manifestSha256 !== row.manifest_sha256) {
    await pool.query(`UPDATE greenfield_module_releases SET release_state='quarantined', quarantined_at=NOW(), updated_at=NOW() WHERE release_id=$1`, [row.release_id])
    fail('checksum mismatch: release quarantined')
  }
  await pool.query(`UPDATE greenfield_module_releases SET release_state='verified', updated_at=NOW() WHERE release_id=$1`, [row.release_id])
  await pool.query(`UPDATE greenfield_module_versions SET status='verified', updated_at=NOW() WHERE module_id=$1 AND version=$2`, [args.module, args.version])
  console.log(`module: ${args.module}`)
  console.log(`version: ${args.version}`)
  console.log('release status: verified')
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
  console.error('Usage: pnpm registry:verify-release --module digital.modula.vault-notes --version 0.1.0')
  process.exit(2)
}
function fail(message) {
  console.error(message)
  process.exit(1)
}
