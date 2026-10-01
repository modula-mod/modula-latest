import {registerModuleIdentityAliases} from '@modula/greenfield-contracts'
import type {ModulaDb} from '../database/client.js'

/**
 * Loads the published identity aliases (greenfield_product_identity_aliases)
 * into the process-wide alias registry used by registry core. The historical
 * aliases are already seeded in @modula/greenfield-contracts, so a failure here
 * degrades to those rather than breaking lookups.
 */
export async function loadRegisteredIdentityAliases(db: ModulaDb, log?: {warn: (obj: unknown, msg?: string) => void}) {
  try {
    const rows = await db.selectFrom('greenfield_product_identity_aliases').select(['alias_id', 'canonical_product_id']).execute()
    const result = registerModuleIdentityAliases(rows.map(row => ({alias: row.alias_id, canonicalId: row.canonical_product_id})))
    if (result.rejected.length) log?.warn({rejected: result.rejected}, 'Some product identity aliases were not registered')
    return result
  } catch (error) {
    log?.warn({err: error}, 'Product identity aliases could not be loaded; using historical aliases only')
    return {registered: 0, rejected: []}
  }
}
