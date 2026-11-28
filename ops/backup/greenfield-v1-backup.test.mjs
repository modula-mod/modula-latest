import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveAcceptedBackupSource} from './greenfield-v1-backup-markers.mjs'

const MAIN = 'a'.repeat(40)
const DEPLOYED = 'b'.repeat(40)
const OTHER = 'c'.repeat(40)

test('accepts checkout equal to origin/main', () => {
  assert.deepEqual(
    resolveAcceptedBackupSource({sourceRevision: MAIN, originMain: MAIN, deployedRevision: DEPLOYED, deployedIsAncestor: true}),
    {accepted: true, basis: 'origin-main'},
  )
})

test('accepts checkout equal to the deployed revision when it is an ancestor of origin/main', () => {
  assert.deepEqual(
    resolveAcceptedBackupSource({sourceRevision: DEPLOYED, originMain: MAIN, deployedRevision: DEPLOYED, deployedIsAncestor: true}),
    {accepted: true, basis: 'deployed-revision'},
  )
})

test('rejects deployed revision that is not an ancestor of origin/main', () => {
  assert.equal(
    resolveAcceptedBackupSource({sourceRevision: DEPLOYED, originMain: MAIN, deployedRevision: DEPLOYED, deployedIsAncestor: false}).accepted,
    false,
  )
})

test('rejects checkout matching neither origin/main nor the deployed revision', () => {
  assert.equal(
    resolveAcceptedBackupSource({sourceRevision: OTHER, originMain: MAIN, deployedRevision: DEPLOYED, deployedIsAncestor: true}).accepted,
    false,
  )
})

test('rejects when the containers disagree (no deployed revision)', () => {
  assert.equal(
    resolveAcceptedBackupSource({sourceRevision: DEPLOYED, originMain: MAIN, deployedRevision: null, deployedIsAncestor: false}).accepted,
    false,
  )
})

test('expected SHA pin keeps strict behaviour', () => {
  assert.deepEqual(
    resolveAcceptedBackupSource({sourceRevision: DEPLOYED, originMain: MAIN, expectedSha: DEPLOYED}),
    {accepted: true, basis: 'expected-sha'},
  )
  assert.equal(
    resolveAcceptedBackupSource({sourceRevision: DEPLOYED, originMain: MAIN, expectedSha: MAIN}).accepted,
    false,
  )
  assert.equal(
    resolveAcceptedBackupSource({sourceRevision: DEPLOYED, originMain: MAIN, expectedSha: 'not-a-sha'}).accepted,
    false,
  )
})
