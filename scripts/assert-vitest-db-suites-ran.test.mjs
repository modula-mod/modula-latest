import {strict as assert} from 'node:assert'
import {spawnSync} from 'node:child_process'
import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import test from 'node:test'

const script = join(dirname(fileURLToPath(import.meta.url)), 'assert-vitest-db-suites-ran.mjs')

function run(report, files) {
  const dir = mkdtempSync(join(tmpdir(), 'assert-vitest-db-suites-'))
  const reportPath = join(dir, 'report.json')
  if (report !== null) writeFileSync(reportPath, JSON.stringify(report))
  const result = spawnSync('node', [script, ...(report === null ? [] : [reportPath]), ...files], {
    encoding: 'utf8',
  })
  return result
}

function reportFor(entries) {
  return {
    testResults: entries.map(entry => ({
      name: `/workspace/services/greenfield-api/${entry.file}`,
      assertionResults: entry.tests,
    })),
  }
}

test('usage with no arguments exits 2', () => {
  const result = run(null, [])
  assert.equal(result.status, 2)
  assert.match(result.stderr, /usage:/)
})

test('all expected files passed exits 0', () => {
  const result = run(reportFor([
    {file: 'tests/lease.test.ts', tests: [{status: 'passed'}, {status: 'passed'}]},
    {file: 'tests/greenfield.accounts.test.ts', tests: [{status: 'passed'}]},
  ]), ['tests/lease.test.ts', 'tests/greenfield.accounts.test.ts'])
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.match(result.stdout, /All 2 DB-gated suite\(s\) ran: 3 tests passed/)
})

test('accepts Windows-style report paths', () => {
  const result = run({
    testResults: [{
      name: 'C:\\repo\\services\\greenfield-worker\\tests\\lease.test.ts',
      assertionResults: [{status: 'passed'}],
    }],
  }, ['tests/lease.test.ts'])
  assert.equal(result.status, 0, result.stderr + result.stdout)
})

test('a skipped test fails the guard', () => {
  const result = run(reportFor([
    {file: 'tests/lease.test.ts', tests: [{status: 'passed'}, {status: 'skipped'}]},
  ]), ['tests/lease.test.ts'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /1 test\(s\) did not pass/)
  assert.match(result.stderr, /skipped/)
})

test('a missing expected file fails the guard', () => {
  const result = run(reportFor([
    {file: 'tests/lease.test.ts', tests: [{status: 'passed'}]},
  ]), ['tests/lease.test.ts', 'tests/missing.test.ts'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /missing.test.ts: not present in the Vitest report/)
})

test('a file with no collected tests fails the guard', () => {
  const result = run(reportFor([
    {file: 'tests/lease.test.ts', tests: []},
  ]), ['tests/lease.test.ts'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /no tests collected/)
})
