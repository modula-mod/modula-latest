#!/usr/bin/env node
// GF-CALL-01: fail CI when a DB-gated Vitest suite was skipped instead of run.
//
// The calls v1 / messaging v3 / VoIP push / GF native endpoints integration suites use
// `describe.skip` when MODULA_TEST_DATABASE_URL is absent, and Vitest exits 0
// for skipped files. This reads a Vitest JSON report and requires every
// expected file to be present, to contain at least one test, and to have every
// test passed (no skipped, todo, pending or failed tests).
//
// Usage: node scripts/assert-vitest-db-suites-ran.mjs <report.json> <test-file>...
import {readFileSync} from 'node:fs'

const [reportPath, ...expectedFiles] = process.argv.slice(2)
if (!reportPath || expectedFiles.length === 0) {
  console.error('usage: assert-vitest-db-suites-ran.mjs <report.json> <test-file>...')
  process.exit(2)
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'))
const results = Array.isArray(report.testResults) ? report.testResults : []
const normalise = value => value.replaceAll('\\', '/')
const failures = []
let total = 0

for (const expected of expectedFiles.map(normalise)) {
  const file = results.find(result => normalise(String(result.name ?? '')).endsWith(`/${expected}`))
  if (!file) {
    failures.push(`${expected}: not present in the Vitest report`)
    continue
  }
  const assertions = Array.isArray(file.assertionResults) ? file.assertionResults : []
  const counts = {}
  for (const assertion of assertions) counts[assertion.status] = (counts[assertion.status] ?? 0) + 1
  const passed = counts.passed ?? 0
  total += assertions.length
  console.log(`${expected}: ${assertions.length} tests, ${passed} passed, ${assertions.length - passed} not passed ${JSON.stringify(counts)}`)
  if (assertions.length === 0) failures.push(`${expected}: no tests collected`)
  else if (passed !== assertions.length) failures.push(`${expected}: ${assertions.length - passed} test(s) did not pass ${JSON.stringify(counts)}`)
}

if (failures.length > 0) {
  console.error('DB-gated suites did not fully run against Postgres:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`All ${expectedFiles.length} DB-gated suite(s) ran: ${total} tests passed, 0 skipped.`)
