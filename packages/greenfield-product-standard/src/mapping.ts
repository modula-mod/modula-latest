import type {NormalizedMpsProduct} from './ingest.js'
import {developerKindFromMps} from './kinds.js'

export type GreenfieldProductProjection = {
  productId: string
  registryKind: string
  developerKind: string
  version: string
  publisherId: string
  familyId: string | null
  familyRole: 'root' | 'member' | null
  aliases: string[]
  relationships: NormalizedMpsProduct['relationships']
  frontendMode: NormalizedMpsProduct['frontendMode']
  frontendArtifact: NormalizedMpsProduct['frontendArtifact']
  backendMode: NormalizedMpsProduct['backendMode']
  greenfieldBackendMode: NormalizedMpsProduct['greenfieldBackendMode']
  storageMode: string | null
  bindsFakeBackend: false
  presentationAssets: NormalizedMpsProduct['presentationAssets']
  capabilities: NormalizedMpsProduct['capabilities']
  permissions: NormalizedMpsProduct['permissions']
  events: NormalizedMpsProduct['events']
  jobs: NormalizedMpsProduct['jobs']
  secretRequirements: NormalizedMpsProduct['secrets']
  entitlements: NormalizedMpsProduct['entitlements']
  privacy: Record<string, unknown> | null
  marketplace: Record<string, unknown> | null
  compatibility: NormalizedMpsProduct['compatibility']
  testFixture: boolean
  visibility: string
  protocol: string
}

export function projectGreenfieldProduct(product: NormalizedMpsProduct): GreenfieldProductProjection {
  return {
    productId: product.productId,
    registryKind: product.kind,
    developerKind: developerKindFromMps(product.kind),
    version: product.version,
    publisherId: product.publisherId,
    familyId: product.familyId,
    familyRole: product.familyRole,
    aliases: product.aliases,
    relationships: product.relationships,
    frontendMode: product.frontendMode,
    frontendArtifact: product.frontendArtifact,
    backendMode: product.backendMode,
    greenfieldBackendMode: product.greenfieldBackendMode,
    storageMode: product.backendMode === 'none' ? null : product.storageMode,
    bindsFakeBackend: false,
    presentationAssets: product.presentationAssets,
    capabilities: product.capabilities,
    permissions: product.permissions,
    events: product.events,
    jobs: product.jobs,
    secretRequirements: product.secrets,
    entitlements: product.entitlements,
    privacy: product.privacy,
    marketplace: product.marketplace,
    compatibility: product.compatibility,
    testFixture: product.testFixture,
    visibility: product.visibility,
    protocol: product.compatibility.greenfieldProtocol ?? 'greenfield.v1',
  }
}
