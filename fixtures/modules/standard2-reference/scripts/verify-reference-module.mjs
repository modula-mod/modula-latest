#!/usr/bin/env node
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {analyzeText} from '../src/analyze-text.mjs'

const manifest = JSON.parse(readFileSync(new URL('../greenfield.manifest.json', import.meta.url), 'utf8'))
const failures = []

expect(manifest.moduleId === 'digital.modula.standard2-reference', 'fixture identifies the Standard 2 reference module')
expect(manifest.standardVersion === '2.0.0', 'fixture uses Standard 2.0.0')
expect(manifest.source.repository === 'modula-mod/modula-latest', 'fixture source points to canonical app repository')
expect(manifest.source.manifestPath === 'fixtures/modules/standard2-reference/greenfield.manifest.json', 'fixture source path is canonical in /root source')
expect(manifest.license.status === 'firstParty', 'fixture license status is first-party test material')
expect(manifest.trust.requestedLevel === 'firstParty', 'fixture trust level is first-party')
expect(Array.isArray(manifest.dependencyGraph?.requires) && manifest.dependencyGraph.requires.length === 1, 'required dependency declared')
expect(Array.isArray(manifest.dependencyGraph?.optional) && manifest.dependencyGraph.optional.length === 1, 'optional dependency declared')
expect(Array.isArray(manifest.dependencyGraph?.recommended) && manifest.dependencyGraph.recommended.length === 1, 'recommended dependency declared')
expect(Array.isArray(manifest.dependencyGraph?.conflicts) && manifest.dependencyGraph.conflicts.length === 1, 'conflict declared')
expect(Array.isArray(manifest.dependencyGraph?.replaces) && manifest.dependencyGraph.replaces.length === 1, 'replacement declared')
expect(manifest.serviceRegistry?.items?.[0]?.kind === 'markdown', 'markdown service declared')
expect(manifest.apiRegistry?.items?.[0]?.path === '/api/modula/digital.modula.standard2-reference/analyze', 'module API path declared')
expect(manifest.hookRegistry?.items?.length === 2, 'before and after hooks declared')
expect(manifest.storageModel?.items?.length === 8, 'all required storage kinds declared')
expect(manifest.uiContributions?.items?.length >= 7, 'generic UI contribution surfaces declared')
expect(manifest.widgetRegistry?.items?.length === 1, 'Board widget declared')
expect(manifest.eventBus?.items?.length === 1, 'event declaration present')

const result = analyzeText({text: '# Phase 7I\nA real module function counts words.\n- [x] verified'})
expect(result.ok === true, 'reference function returns ok')
expect(result.wordCount === 9, 'reference function counts visible words')
expect(result.characterCount > 0, 'reference function counts characters')
expect(result.headings[0] === 'Phase 7I', 'reference function extracts headings')
expect(result.hasTaskList === true, 'reference function detects task lists')

console.log(`reference fixture manifest sha256 ${sha256(JSON.stringify(manifest))}`)

if (failures.length > 0) {
  console.error(`Standard 2 reference fixture verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}
console.log('Standard 2 reference fixture verifier passed')

function expect(condition, label) {
  if (condition) console.log(`PASS ${label}`)
  else {
    failures.push(label)
    console.error(`FAIL ${label}`)
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
