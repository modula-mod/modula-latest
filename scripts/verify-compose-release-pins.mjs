#!/usr/bin/env node
/**
 * GF-OPS-01: release-pin hygiene for ops/docker compose files.
 *
 * - Release identity variables in compose.production.yml must be required
 *   (`${VAR:?message}`), never defaulted. A stale default (previously
 *   076_greenfield_premium_entitlements) let a hand-run compose start a
 *   container that reports the wrong expected migration and fails readiness.
 * - No compose interpolation default in ops/docker may hard-code a migration id.
 * - The production worker must carry the heartbeat healthcheck (G033) without
 *   publishing a port.
 * - The canonical backend verifier must not pin a literal schema version.
 *
 * Compose interpolation is emulated here (compose-spec rules for ${V}, ${V:-d},
 * ${V-d}, ${V:?e}, ${V?e}, nesting and $$) so CI can prove fail-fast without a
 * Docker daemon. `docker compose config` remains the authoritative check where
 * Docker is available.
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'

export const PRODUCTION_COMPOSE = 'ops/docker/compose.production.yml'
export const REQUIRED_RELEASE_VARIABLES = ['SOURCE_RELEASE_SHA', 'SOURCE_BUILT_AT', 'SOURCE_EXPECTED_MIGRATION']
const MIGRATION_ID = /\b\d{3}_[a-z0-9]+(?:_[a-z0-9]+)*\b/

/** Parse `${...}` expressions; returns [{name, operator, argument, nested, raw}] for every level. */
export function expansions(text, nested = false) {
  const found = []
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '$' && text[index + 1] === '$') { index += 1; continue }
    if (text[index] !== '$' || text[index + 1] !== '{') continue
    const end = matchingBrace(text, index + 1)
    if (end < 0) throw new Error(`unterminated interpolation at offset ${index}`)
    const body = text.slice(index + 2, end)
    const match = /^([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-?+])([\s\S]*))?$/.exec(body)
    if (!match) throw new Error(`invalid interpolation: \${${body}}`)
    const [, name, operator = '', argument = ''] = match
    found.push({name, operator, argument, nested, raw: text.slice(index, end + 1)})
    found.push(...expansions(argument, true))
    index = end
  }
  return found
}

function matchingBrace(text, open) {
  let depth = 0
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1
    else if (text[index] === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

/** Compose-spec interpolation; throws like `docker compose config` on a required variable. */
export function interpolate(text, env) {
  let output = ''
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '$' && text[index + 1] === '$') { output += '$'; index += 1; continue }
    if (text[index] !== '$' || text[index + 1] !== '{') { output += text[index]; continue }
    const end = matchingBrace(text, index + 1)
    const body = text.slice(index + 2, end)
    const [, name, operator = '', argument = ''] = /^([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-?+])([\s\S]*))?$/.exec(body)
    const value = env[name]
    const unsetOrEmpty = value === undefined || value === ''
    const missing = operator.startsWith(':') ? unsetOrEmpty : value === undefined
    if (operator.endsWith('-')) output += missing ? interpolate(argument, env) : value
    else if (operator.endsWith('?')) {
      if (missing) throw new Error(`required variable ${name} is missing a value: ${interpolate(argument, env)}`)
      output += value
    } else if (operator.endsWith('+')) output += missing ? '' : interpolate(argument, env)
    else output += value ?? ''
    index = end
  }
  return output
}

export function checkComposeReleasePins({root = '.', read = path => readFileSync(join(root, path), 'utf8'), list = dir => readdirSync(join(root, dir))} = {}) {
  const failures = []
  const fail = message => failures.push(message)
  const production = read(PRODUCTION_COMPOSE)
  const all = expansions(production)

  for (const name of REQUIRED_RELEASE_VARIABLES) {
    const uses = all.filter(item => item.name === name)
    if (!uses.length) fail(`${PRODUCTION_COMPOSE} does not reference ${name}`)
    for (const item of uses) {
      if (item.nested) continue
      if (item.operator !== ':?') fail(`${PRODUCTION_COMPOSE} must require ${name} with \${${name}:?...}, found ${item.raw}`)
      else if (!item.argument.trim()) fail(`${PRODUCTION_COMPOSE} ${name} requirement has no operator-facing message`)
    }
  }

  for (const file of list('ops/docker').filter(name => /\.ya?ml$/.test(name))) {
    const path = `ops/docker/${file}`
    for (const item of expansions(read(path))) {
      if ((item.operator === ':-' || item.operator === '-') && MIGRATION_ID.test(item.argument)) {
        fail(`${path} hard-codes migration id default in ${item.raw}`)
      }
    }
  }

  const baseEnv = {SOURCE_RELEASE_SHA: 'a'.repeat(40), SOURCE_BUILT_AT: '2026-01-01T00:00:00Z', SOURCE_EXPECTED_MIGRATION: '999_fixture_tip'}
  try {
    const rendered = interpolate(production, baseEnv)
    if (!rendered.includes('org.modula.migration.expected: 999_fixture_tip')) fail('interpolated production compose does not carry the explicit expected migration label')
    if (!rendered.includes('MODULA_EXPECTED_MIGRATION: 999_fixture_tip')) fail('interpolated production compose does not pass the explicit expected migration to services')
  } catch (error) {
    fail(`production compose does not interpolate with a complete release identity: ${error.message}`)
  }
  for (const name of REQUIRED_RELEASE_VARIABLES) {
    for (const env of [{...baseEnv, [name]: undefined}, {...baseEnv, [name]: ''}]) {
      let threw = false
      try { interpolate(production, env) } catch (error) { threw = String(error.message).includes(name) }
      if (!threw) fail(`production compose does not fail fast when ${name} is ${env[name] === '' ? 'empty' : 'unset'}`)
    }
  }

  const worker = serviceBlock(production, 'greenfield-worker')
  if (!worker) fail('production compose has no greenfield-worker service')
  else {
    if (!/\n {4}healthcheck:\n {6}test: \['CMD', 'node', '\/opt\/modula\/healthcheck\/worker-heartbeat\.cjs'\]/.test(worker)) fail('greenfield-worker lacks the heartbeat healthcheck')
    if (!worker.includes('./greenfield-worker-heartbeat-healthcheck.cjs:/opt/modula/healthcheck/worker-heartbeat.cjs:ro')) fail('greenfield-worker healthcheck script is not mounted read-only')
    if (/\n {4}ports:/.test(worker)) fail('greenfield-worker must not publish ports')
  }
  const probe = existsSync(join(root, 'ops/docker/greenfield-worker-heartbeat-healthcheck.cjs')) ? read('ops/docker/greenfield-worker-heartbeat-healthcheck.cjs') : ''
  if (!probe.includes('greenfield_worker_heartbeats')) fail('worker healthcheck does not read greenfield_worker_heartbeats')
  if (/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE)\b/.test(probe.replace(/\/\/.*$/gm, ''))) fail('worker healthcheck must be read-only')

  const verifier = read('scripts/verify-greenfield-backend-v1.mjs')
  if (/schema\s*===\s*'\d{3}'/.test(verifier)) fail('scripts/verify-greenfield-backend-v1.mjs pins a literal schema version')

  return {ok: failures.length === 0, failures}
}

function serviceBlock(text, name) {
  const start = text.indexOf(`\n  ${name}:\n`)
  if (start < 0) return ''
  const rest = text.slice(start + 1)
  const next = rest.slice(1).search(/\n {2}[a-z0-9-]+:\n|\n[a-z]/)
  return next < 0 ? rest : rest.slice(0, next + 1)
}
