export type GreenfieldModuleLicenseEvidenceType =
  | 'rootLicense'
  | 'packageMetadata'
  | 'readmeDeclaration'
  | 'registryMetadata'
  | 'maintainerStatement'
  | 'founderOverride'
  | 'firstPartyPolicy'

export type GreenfieldModuleLicenseEvidence = {
  evidenceId: string
  moduleId: string
  version: string
  evidenceType: GreenfieldModuleLicenseEvidenceType
  summary: string
  sourcePath?: string
  checksum?: string
  createdAt: string
}

export type GreenfieldModuleProvenance = {
  provider: 'github'
  repository: string
  repositoryId?: string
  defaultBranch?: string
  commit: string
  manifestPath: string
  releaseTag?: string
  releaseAssetName?: string
  fetchedAt: string
  etag?: string
}
