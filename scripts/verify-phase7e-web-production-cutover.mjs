#!/usr/bin/env node
import {createHash} from 'node:crypto'
import {promises as dns} from 'node:dns'
import {existsSync, lstatSync, readFileSync, realpathSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

const failures = []
const root = process.cwd()
const productionRoot = '/var/www/modula'
const currentLink = join(productionRoot, 'current')
const apex = 'https://modula.digital'
const www = 'https://www.modula.digital'
const apiHealth = 'https://api.modula.digital/v1/meta'

const routePaths = [
  '/',
  '/sign-in',
  '/register',
  '/discover',
  '/profile',
  '/board',
  '/product',
  '/modules',
  '/module/digital.modula.standard2-reference',
  '/module/modula.vault-notes',
  '/settings',
]

const branch = git(['branch', '--show-current'])
const head = git(['rev-parse', 'HEAD'])
const originMain = git(['rev-parse', 'origin/main'])
expect(Boolean(head), 'main commit identified')
expect(branch === 'main', 'verifier is running from main')
expect(Boolean(originMain) && head === originMain, 'local main equals origin/main')

await verifyDns()
const releaseDir = verifyArtifact(head)
const marker = releaseDir ? verifyMarker(releaseDir, head) : null
const homepage = await verifyApex(marker)
await verifyWwwRedirect()
await verifyAssets(homepage)
await verifyRoutes()
await verifyApiHealth()
verifyNoDevelopmentProviders(releaseDir)

if (failures.length > 0) {
  console.error(`Phase 7E web production cutover verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'ok',
  commit: head,
  releaseDir,
  marker,
  routes: routePaths,
}, null, 2))
console.log('Phase 7E web production cutover verifier passed')

function verifyArtifact(expectedCommit) {
  if (!existsSync(currentLink)) {
    fail(`missing production current symlink ${currentLink}`)
    return null
  }
  if (!lstatSync(currentLink).isSymbolicLink()) {
    fail(`${currentLink} is not an atomic release symlink`)
    return null
  }
  const releaseDir = realpathSync(currentLink)
  expect(releaseDir.startsWith(`${productionRoot}/releases/`), 'production artifact lives under releases/')
  for (const file of ['index.html', 'version.json', 'release.json', 'checksums.sha256']) {
    expect(existsSync(join(releaseDir, file)), `production artifact includes ${file}`)
  }
  const checksums = spawnSync('sha256sum', ['-c', 'checksums.sha256'], {cwd: releaseDir, encoding: 'utf8', shell: false})
  if (checksums.status === 0) pass('production artifact checksum manifest verifies')
  else fail(`production artifact checksum manifest failed: ${checksums.stderr || checksums.stdout}`)
  const markerText = existsSync(join(releaseDir, 'version.json')) ? readFileSync(join(releaseDir, 'version.json'), 'utf8') : '{}'
  if (expectedCommit && markerText.includes(expectedCommit)) pass('production artifact marker references current main commit')
  else fail('production artifact marker does not reference current main commit')
  return releaseDir
}

function verifyMarker(releaseDir, expectedCommit) {
  const marker = JSON.parse(readFileSync(join(releaseDir, 'version.json'), 'utf8'))
  expect(marker.app === 'modula', 'version marker identifies Modula')
  expect(marker.commit === expectedCommit, 'version marker matches main')
  expect(marker.environment === 'production', 'version marker is production')
  expect(marker.dataSource === 'remote', 'version marker uses remote data source')
  expect(marker.apiOrigin === 'https://api.modula.digital', 'version marker uses production API origin')
  return marker
}

async function verifyDns() {
  const [apexA, apexAaaa, wwwA, wwwAaaa] = await Promise.all([
    dns.resolve4('modula.digital').catch(() => []),
    dns.resolve6('modula.digital').catch(() => []),
    dns.resolve4('www.modula.digital').catch(() => []),
    dns.resolve6('www.modula.digital').catch(() => []),
  ])
  expect(apexA.length + apexAaaa.length > 0, 'apex domain resolves')
  expect(wwwA.length + wwwAaaa.length > 0, 'www domain resolves')
}

async function verifyApex(localMarker) {
  const [html, markerText] = await Promise.all([
    fetchText(`${apex}/`, {headers: {'cache-control': 'no-cache'}}),
    fetchText(`${apex}/version.json`, {headers: {'cache-control': 'no-cache'}}),
  ])
  expect(!/Open WebUI/i.test(html), 'apex OpenWebUI signature absent')
  expect(/_expo\/static|id="root"|Modula/i.test(html), 'apex returns Modula app shell')
  expect(!/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(html), 'apex shell does not contain localhost URLs')
  let remoteMarker = {}
  try {
    remoteMarker = JSON.parse(markerText)
  } catch {
    fail('live version marker is valid JSON')
  }
  expect(remoteMarker.commit === localMarker?.commit, 'live version marker matches deployed main marker')
  return html
}

async function verifyWwwRedirect() {
  try {
    const response = await fetch(www, {redirect: 'manual', headers: {'cache-control': 'no-cache'}})
    expect([301, 302, 307, 308].includes(response.status), 'www returns a redirect')
    const location = response.headers.get('location') ?? ''
    expect(location === `${apex}/` || location === apex, 'www redirects to canonical apex')
  } catch (error) {
    fail(`www redirect fetch failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function verifyAssets(html) {
  const assets = [...html.matchAll(/(?:src|href)="([^"]*\/_expo\/static\/[^"]+)"/g)].map(match => match[1]!)
  expect(assets.length > 0, 'JavaScript/CSS assets discovered from app shell')
  for (const asset of assets.slice(0, 8)) {
    const url = asset.startsWith('http') ? asset : `${apex}${asset.startsWith('/') ? asset : `/${asset}`}`
    try {
      const response = await fetch(url, {headers: {'cache-control': 'no-cache'}})
      expect(response.ok, `asset responds ${url}`)
      const text = await response.text()
      expect(!/Open WebUI/i.test(text), `asset ${url} does not contain OpenWebUI signature`)
      expect(!/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(text), `asset ${url} does not contain localhost URLs`)
    } catch (error) {
      fail(`asset fetch failed ${url}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

async function verifyRoutes() {
  for (const path of routePaths) {
    try {
      const response = await fetch(`${apex}${path}`, {headers: {'cache-control': 'no-cache'}})
      const text = await response.text()
      expect(response.ok, `route responds ${path}`)
      expect(!/Open WebUI/i.test(text), `route ${path} OpenWebUI signature absent`)
      expect(!/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(text), `route ${path} does not contain localhost URLs`)
    } catch (error) {
      fail(`route fetch failed ${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

async function verifyApiHealth() {
  try {
    const response = await fetch(apiHealth, {headers: {'cache-control': 'no-cache'}})
    const text = await response.text()
    expect(response.ok, 'API health is reachable')
    expect(!/Open WebUI/i.test(text), 'API health is not OpenWebUI')
    expect(/greenfield|modula/i.test(text), 'API health identifies Modula or Greenfield')
  } catch (error) {
    fail(`API health fetch failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function verifyNoDevelopmentProviders(releaseDir) {
  if (!releaseDir) return
  const checksums = readFileSync(join(releaseDir, 'checksums.sha256'), 'utf8')
  expect(!/deterministic|mock-ai|dev-provider/i.test(checksums), 'checksum manifest contains no development provider names')
  const marker = readFileSync(join(releaseDir, 'version.json'), 'utf8')
  expect(!/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(marker), 'version marker has no local API origin')
}

async function fetchText(url, init = {}) {
  try {
    const response = await fetch(url, init)
    if (!response.ok) {
      fail(`${url} returned ${response.status}`)
      return ''
    }
    return response.text()
  } catch (error) {
    fail(`${url} fetch failed: ${error instanceof Error ? error.message : String(error)}`)
    return ''
  }
}

function git(args) {
  const result = spawnSync('git', args, {cwd: root, encoding: 'utf8', shell: false})
  return result.status === 0 ? result.stdout.trim() : null
}

function pass(message) {
  console.log(`PASS ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function expect(condition, message) {
  if (condition) pass(message)
  else fail(message)
}
