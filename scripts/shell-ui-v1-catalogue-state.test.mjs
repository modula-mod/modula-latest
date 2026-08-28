#!/usr/bin/env node
/** Behavioral checks for Product Hub catalogue presentation (no RN runtime). */

function presentProductHubCatalogue(input) {
  const items = input.data ?? []
  if (items.length > 0) {
    if (input.isError) return {kind: 'partial', items, error: input.error}
    return {kind: 'ready', items}
  }
  if (input.isPending && input.data === undefined) {
    return {kind: 'initial-loading', items: []}
  }
  if (input.isError) {
    return {kind: 'full-failure', items: [], error: input.error}
  }
  return {kind: 'successful-empty', items: []}
}

const cases = [
  {
    name: 'initial loading',
    input: {data: undefined, isPending: true, isError: false, error: null},
    kind: 'initial-loading',
  },
  {
    name: 'successful empty',
    input: {data: [], isPending: false, isError: false, error: null},
    kind: 'successful-empty',
  },
  {
    name: 'ready keeps items',
    input: {data: [{id: 'a'}], isPending: false, isError: false, error: null},
    kind: 'ready',
  },
  {
    name: 'partial keeps last-known items',
    input: {data: [{id: 'a'}], isPending: false, isError: true, error: new Error('enrichment')},
    kind: 'partial',
  },
  {
    name: 'full failure with no data',
    input: {data: undefined, isPending: false, isError: true, error: new Error('down')},
    kind: 'full-failure',
  },
  {
    name: 'never flash valid catalogue to empty on error',
    input: {data: [{id: 'vault'}], isPending: false, isError: true, error: new Error('secondary')},
    kind: 'partial',
    assert: result => result.items.length === 1,
  },
]

let failed = 0
for (const test of cases) {
  const result = presentProductHubCatalogue(test.input)
  const ok = result.kind === test.kind && (test.assert ? test.assert(result) : true)
  console.log(`${test.name.padEnd(48)} ${ok ? 'PASS' : 'FAIL'}  ${result.kind}`)
  if (!ok) failed += 1
}

if (failed) {
  console.error(`\nshell-ui-v1-catalogue-state FAIL (${failed})`)
  process.exit(1)
}
console.log('\nshell-ui-v1-catalogue-state PASS')
