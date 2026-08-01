#!/usr/bin/env node
import {createHash} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {manifestChecksum} from '@modula/greenfield-module-manifest'
import {fail, finish, git, includes, json, pass, run, runQuiet, vaultNotesRoot} from './phase7e-vault-notes-verifier-utils.mjs'

const releaseTag = 'vault-notes-v1.1.0'
const head = git(vaultNotesRoot, ['rev-parse', 'HEAD'])
const tag = git(vaultNotesRoot, ['rev-list', '-n', '1', releaseTag])
if (head && tag && isAncestor(vaultNotesRoot, tag, head)) pass(`${releaseTag} release commit is contained in Vault Notes HEAD`)
else fail(`${releaseTag} must be contained in Vault Notes HEAD`)

const manifest = json('module.manifest.json')
const manifestSha = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
if (manifest.integrity?.manifestSha256 === manifestSha) pass('Greenfield manifest checksum matches file content')
else fail(`Greenfield manifest checksum mismatch: expected ${manifestSha}`)

const provenancePath = join(vaultNotesRoot, 'release/vault-notes-v1.1.0.provenance.json')
if (!existsSync(provenancePath)) fail('Vault Notes release provenance is missing')
else {
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'))
  if (provenance.moduleId === 'modula.vault-notes' && provenance.moduleVersion === '1.1.0') pass('release provenance identifies Vault Notes 1.1')
  else fail('release provenance identity mismatch')
  if (provenance.releaseTag === releaseTag) pass('release provenance records immutable tag')
  else fail('release provenance tag mismatch')
  if (provenance.releaseCommit === tag) pass('release provenance records immutable release tag commit')
  else fail('release provenance commit mismatch')
  if (provenance.standardReleaseTag === 'mms-v1.2.0') pass('release provenance records Standard tag')
  else fail('release provenance Standard tag missing')
  const standardRoot = join(vaultNotesRoot, '../modula-module-standard')
  const standardHead = git(standardRoot, ['rev-parse', 'HEAD'])
  const standardTag = git(standardRoot, ['rev-list', '-n', '1', provenance.standardReleaseTag])
  if (standardTag && provenance.standardReleaseCommit === standardTag) pass('release provenance records Standard release tag commit')
  else fail('release provenance Standard commit mismatch')
  if (standardHead && standardTag && isAncestor(standardRoot, standardTag, standardHead)) pass('Standard release tag commit is contained in current Standard HEAD')
  else fail('Standard release tag commit must be contained in current Standard HEAD')
  const packagePath = join(vaultNotesRoot, 'release/modula-vault-notes-1.1.0.tgz')
  if (existsSync(packagePath)) {
    const actualPackageSha = createHash('sha256').update(readFileSync(packagePath)).digest('hex')
    if (provenance.packageChecksum === actualPackageSha) pass('package checksum matches immutable artifact')
    else fail('package checksum mismatch')
  } else {
    fail('immutable package artifact is missing')
  }
}

includes('scripts/registry/import-module.mjs', [
  'Module repository working tree must be clean',
  'Supplied commit does not match module HEAD',
  'Manifest file checksum mismatch',
  'releaseSha256',
], 'fail-closed registry import command')
run('pnpm', ['verify'], 'external Vault Notes verifier passes before release acceptance', vaultNotesRoot)

finish('Phase 7E Vault Notes release verifier')

function isAncestor(cwd, ancestor, descendant) {
  return runQuiet('git', ['-C', cwd, 'merge-base', '--is-ancestor', ancestor, descendant]).status === 0
}
