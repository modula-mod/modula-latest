#!/usr/bin/env node
import {createHash} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {manifestChecksum} from '@modula/greenfield-module-manifest'
import {fail, finish, git, includes, json, pass, run, vaultNotesRoot} from './phase7e-vault-notes-verifier-utils.mjs'

const releaseTag = 'vault-notes-v1.0.0'
const head = git(vaultNotesRoot, ['rev-parse', 'HEAD'])
const tag = git(vaultNotesRoot, ['rev-list', '-n', '1', releaseTag])
if (head && tag && head === tag) pass(`${releaseTag} points at Vault Notes HEAD`)
else fail(`${releaseTag} must point at Vault Notes HEAD`)

const manifest = json('module.manifest.json')
const manifestSha = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
if (manifest.integrity?.manifestSha256 === manifestSha) pass('Greenfield manifest checksum matches file content')
else fail(`Greenfield manifest checksum mismatch: expected ${manifestSha}`)

const provenancePath = join(vaultNotesRoot, 'release/vault-notes-v1.0.0.provenance.json')
if (!existsSync(provenancePath)) fail('Vault Notes release provenance is missing')
else {
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'))
  if (provenance.moduleId === 'modula.vault-notes' && provenance.moduleVersion === '1.0.0') pass('release provenance identifies Vault Notes 1.0')
  else fail('release provenance identity mismatch')
  if (provenance.releaseTag === releaseTag) pass('release provenance records immutable tag')
  else fail('release provenance tag mismatch')
  if (provenance.releaseCommit === head) pass('release provenance records HEAD commit')
  else fail('release provenance commit mismatch')
  if (provenance.standardReleaseTag === 'mms-v1.0.0') pass('release provenance records Standard tag')
  else fail('release provenance Standard tag missing')
  if (provenance.standardReleaseCommit === 'ac1bede6e9be6518a21e8248596b99b4099da5c6') pass('release provenance records Standard release commit')
  else fail('release provenance Standard commit mismatch')
  const packagePath = join(vaultNotesRoot, 'release/modula-vault-notes-1.0.0.tgz')
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
