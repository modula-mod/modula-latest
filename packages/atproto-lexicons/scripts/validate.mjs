#!/usr/bin/env node
/**
 * Validates every lexicon JSON file under lexicons/digital/modula/temp/:
 *  1. File parses as JSON
 *  2. `id` (NSID) matches the file's directory path
 *  3. `id` matches one of the expected Modula NSIDs
 *  4. `lexicon` version field is present
 *  5. `defs.main` exists and is a `record`
 *  6. No forbidden private field names appear anywhere in the record shape
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const lexiconsDir = path.join(root, 'lexicons', 'digital', 'modula', 'temp')

const EXPECTED_NSIDS = [
  'digital.modula.temp.profileExtension',
  'digital.modula.temp.moduleManifest',
  'digital.modula.temp.publication',
]

const FORBIDDEN_PRIVATE_FIELDS = [
  'email',
  'emailAddress',
  'password',
  'passwordHash',
  'sessionToken',
  'accessToken',
  'refreshToken',
  'authToken',
  'oauthToken',
  'dpopKey',
  'dpopNonce',
  'privateKey',
  'secret',
  'apiKey',
  'ipAddress',
  'deviceId',
  'phoneNumber',
  'ssn',
  'actorId',
  'internalId',
  'moderationNotes',
]

let failures = 0
function ok(msg) {
  console.log(`PASS ${msg}`)
}
function fail(msg) {
  console.error(`FAIL ${msg}`)
  failures += 1
}

function findForbiddenFields(value, path = '') {
  const hits = []
  if (Array.isArray(value)) {
    value.forEach((item, index) => hits.push(...findForbiddenFields(item, `${path}[${index}]`)))
    return hits
  }
  if (typeof value !== 'object' || value === null) return hits
  for (const [key, nested] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key
    if (FORBIDDEN_PRIVATE_FIELDS.includes(key)) hits.push(nextPath)
    hits.push(...findForbiddenFields(nested, nextPath))
  }
  return hits
}

if (!fs.existsSync(lexiconsDir)) {
  fail(`lexicons directory missing: ${lexiconsDir}`)
} else {
  const files = fs.readdirSync(lexiconsDir).filter(name => name.endsWith('.json'))
  if (files.length === 0) fail('no lexicon JSON files found')

  const seenNsids = new Set()

  for (const file of files) {
    const fullPath = path.join(lexiconsDir, file)
    const raw = fs.readFileSync(fullPath, 'utf8')

    let json
    try {
      json = JSON.parse(raw)
    } catch (error) {
      fail(`${file}: invalid JSON (${error.message})`)
      continue
    }
    ok(`${file}: parses as JSON`)

    if (typeof json.lexicon !== 'number') {
      fail(`${file}: missing numeric "lexicon" version field`)
    } else {
      ok(`${file}: has lexicon version`)
    }

    if (typeof json.id !== 'string') {
      fail(`${file}: missing "id" (NSID)`)
      continue
    }

    if (!EXPECTED_NSIDS.includes(json.id)) {
      fail(`${file}: unexpected NSID "${json.id}" (expected one of ${EXPECTED_NSIDS.join(', ')})`)
    } else {
      ok(`${file}: NSID "${json.id}" is a known Modula NSID`)
    }

    const expectedFileBase = json.id.split('.').pop()
    if (`${expectedFileBase}.json` !== file) {
      fail(`${file}: filename does not match NSID leaf segment (expected ${expectedFileBase}.json)`)
    } else {
      ok(`${file}: filename matches NSID leaf segment`)
    }

    seenNsids.add(json.id)

    const main = json.defs && json.defs.main
    if (!main) {
      fail(`${file}: missing defs.main`)
      continue
    }
    if (main.type !== 'record') {
      fail(`${file}: defs.main.type must be "record" (got ${main.type})`)
    } else {
      ok(`${file}: defs.main is a record`)
    }
    if (!main.key) {
      fail(`${file}: record missing "key" strategy`)
    }

    const forbiddenHits = findForbiddenFields(main.record ?? {})
    if (forbiddenHits.length > 0) {
      fail(`${file}: forbidden private field(s) present: ${forbiddenHits.join(', ')}`)
    } else {
      ok(`${file}: no forbidden private fields`)
    }
  }

  for (const nsid of EXPECTED_NSIDS) {
    if (!seenNsids.has(nsid)) fail(`expected NSID missing from lexicons directory: ${nsid}`)
  }
}

if (failures > 0) {
  console.error(`\n@modula/atproto-lexicons validate failed with ${failures} issue(s)`)
  process.exit(1)
}
console.log('\n@modula/atproto-lexicons validate passed')
