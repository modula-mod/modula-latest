#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const checkPublic = process.argv.includes('--public')
const appId = 'M29V4ZGUNK.digital.modula.app'
const androidPackage = 'digital.modula.app'
const androidFingerprint = 'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C'

const targets = [
  {
    label: 'source',
    aasa: path.join(repoRoot, 'public/.well-known/apple-app-site-association'),
    assetlinks: path.join(repoRoot, 'public/.well-known/assetlinks.json'),
    required: true,
  },
  {
    label: 'dist',
    aasa: path.join(repoRoot, 'dist/.well-known/apple-app-site-association'),
    assetlinks: path.join(repoRoot, 'dist/.well-known/assetlinks.json'),
    required: fs.existsSync(path.join(repoRoot, 'dist')),
  },
]

let failures = 0

for (const target of targets) {
  if (!target.required) continue
  validateFile(`${target.label}:aasa`, target.aasa, validateAasa)
  validateFile(`${target.label}:assetlinks`, target.assetlinks, validateAssetLinks)
}

if (checkPublic) {
  await validatePublic('https://modula.digital/.well-known/apple-app-site-association', validateAasa)
  await validatePublic('https://modula.digital/.well-known/assetlinks.json', validateAssetLinks)
}

if (failures > 0) {
  console.error(`associated_domain_verifier_failed failures=${failures}`)
  process.exit(1)
}

console.log(`associated_domain_verifier_ok public=${checkPublic ? 'checked' : 'not_checked'}`)

function validateFile(label, fullPath, validator) {
  if (!fs.existsSync(fullPath)) {
    fail(`${label} missing ${path.relative(repoRoot, fullPath)}`)
    return
  }
  const raw = fs.readFileSync(fullPath, 'utf8')
  if (looksLikeHtml(raw)) fail(`${label} looks like HTML`)
  const parsed = parseJson(label, raw)
  if (parsed === undefined) return
  validator(label, parsed)
  pass(`${label} valid`)
}

async function validatePublic(url, validator) {
  const response = await fetch(url, {headers: {accept: 'application/json'}})
  const contentType = response.headers.get('content-type') ?? ''
  const raw = await response.text()
  if (!response.ok) fail(`${url} returned ${response.status}`)
  if (contentType.toLowerCase().includes('text/html')) fail(`${url} returned HTML content-type ${contentType}`)
  if (looksLikeHtml(raw)) fail(`${url} body looks like HTML`)
  const parsed = parseJson(url, raw)
  if (parsed === undefined) return
  validator(url, parsed)
  pass(`${url} valid`)
}

function validateAasa(label, value) {
  const details = value?.applinks?.details
  const webCredentialsApps = value?.webcredentials?.apps
  const appIds = Array.isArray(details)
    ? details.flatMap(item => Array.isArray(item?.appIDs) ? item.appIDs : [])
    : []
  if (!appIds.includes(appId)) fail(`${label} missing applinks appID ${appId}`)
  if (!Array.isArray(webCredentialsApps) || !webCredentialsApps.includes(appId)) {
    fail(`${label} missing webcredentials app ${appId}`)
  }
}

function validateAssetLinks(label, value) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`)
    return
  }
  const match = value.find(item =>
    Array.isArray(item?.relation) &&
    item.relation.includes('delegate_permission/common.handle_all_urls') &&
    item.relation.includes('delegate_permission/common.get_login_creds') &&
    item?.target?.namespace === 'android_app' &&
    item?.target?.package_name === androidPackage &&
    Array.isArray(item?.target?.sha256_cert_fingerprints) &&
    item.target.sha256_cert_fingerprints.includes(androidFingerprint),
  )
  if (!match) fail(`${label} missing package ${androidPackage} and expected SHA-256 fingerprint`)
}

function parseJson(label, raw) {
  try {
    return JSON.parse(raw)
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

function looksLikeHtml(raw) {
  return /^\s*<!doctype html/i.test(raw) || /^\s*<html/i.test(raw)
}

function pass(message) {
  console.log(`PASS ${message}`)
}

function fail(message) {
  failures += 1
  console.error(`FAIL ${message}`)
}
