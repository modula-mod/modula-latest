import assert from 'node:assert/strict'
import {preserveAuthoritativeCatalogue} from '../src/data/repositories/api/preserveAuthoritativeCatalogue.js'

const product = {
  moduleId: 'digital.modula.catalogue-resilience',
  installationState: 'available',
}

void (async () => {
  const catalogue = await preserveAuthoritativeCatalogue(
    [product],
    async () => {
      throw new Error('secondary installation projection unavailable')
    },
    () => [],
  )
  assert.equal(catalogue.length, 1)
  assert.equal(catalogue[0]?.moduleId, product.moduleId)
  assert.equal(catalogue[0]?.installationState, 'available')

  const enriched = await preserveAuthoritativeCatalogue(
    [product],
    async () => [{moduleId: product.moduleId, installationState: 'enabled'}],
    (items, installed) => items.map(item => ({...item, installationState: installed[0]?.installationState ?? item.installationState})),
  )
  assert.equal(enriched[0]?.installationState, 'enabled')
  console.log('CATALOGUE FLASH TO EMPTY = 0')
})()
