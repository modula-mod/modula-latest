/**
 * Verifies published SHA-256 vectors for canonical JSON (Node crypto).
 * Mirrors packages/greenfield-protocol/src/hashing.ts GREENFIELD_HASHING_TEST_VECTORS.
 */
import {createHash} from 'node:crypto'

function sortValue(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortValue)
  const sorted = {}
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortValue(value[key])
  }
  return sorted
}

function canonicalJsonStringify(value) {
  return JSON.stringify(sortValue(value))
}

const VECTORS = [
  {
    name: 'empty-object',
    value: {},
    canonicalJson: '{}',
    sha256Hex: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
  },
  {
    name: 'key-order-independence',
    value: {b: 2, a: 1},
    canonicalJson: '{"a":1,"b":2}',
    sha256Hex: '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777',
  },
  {
    name: 'nested',
    value: {z: {y: 1, x: 2}, a: [3, 1]},
    canonicalJson: '{"a":[3,1],"z":{"x":2,"y":1}}',
    sha256Hex: '3ca4dff6ddb1c5e01cb0ba97b133b6c94a536c50317ead6ce8b87d40ca7bd572',
  },
]

let failed = 0
for (const vector of VECTORS) {
  const canonical = canonicalJsonStringify(vector.value)
  const digest = createHash('sha256').update(canonical).digest('hex')
  if (canonical !== vector.canonicalJson || digest !== vector.sha256Hex) {
    console.error(`FAIL ${vector.name}`, {canonical, digest, expected: vector})
    failed += 1
  } else {
    console.log(`PASS ${vector.name}`)
  }
}

if (failed > 0) process.exit(1)
console.log('All Greenfield hashing vectors passed.')
