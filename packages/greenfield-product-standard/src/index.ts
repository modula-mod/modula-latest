export {
  adaptLegacyProductDocument,
  adaptLegacyToMpsShape,
  detectManifestFormat,
  LEGACY_MANIFEST_FILENAMES,
  toMpsEventType,
} from './adapters.js'
export {ingestProductManifest, parseModulaProductJson, validateModulaProduct} from './ingest.js'
export type {IngestResult, NormalizedMpsProduct} from './ingest.js'
export {projectGreenfieldProduct} from './mapping.js'
export type {GreenfieldProductProjection} from './mapping.js'
export {
  developerKindFromMps,
  greenfieldBackendModeFromMps,
  isMpsProductKind,
  MPS_PRODUCT_KINDS,
  registryKindFromDeclared,
} from './kinds.js'
export type {MpsProductKind, RegistryProductKind} from './kinds.js'
