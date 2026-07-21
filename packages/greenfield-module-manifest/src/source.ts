export type GreenfieldGitHubModuleSource = {
  repository: string
  repositoryId?: string
  defaultBranch?: string
  commit: string
  manifestPath: string
  releaseTag?: string
  releaseAssetName?: string
  fetchedAt?: string
  etag?: string
}

const FULL_GIT_COMMIT_PATTERN = /^[0-9a-f]{40}$/i
const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const MUTABLE_REFS = new Set(['main', 'master', 'latest', 'head', 'HEAD'])

export function isImmutableGitCommit(value: string): boolean {
  return FULL_GIT_COMMIT_PATTERN.test(value)
}

export function isMutableGitReference(value: string): boolean {
  return MUTABLE_REFS.has(value) || MUTABLE_REFS.has(value.toLowerCase())
}

export function isGitHubRepository(value: string): boolean {
  return GITHUB_REPOSITORY_PATTERN.test(value) && value.length <= 160
}

export function isSafeManifestPath(value: string): boolean {
  if (!value || value.length > 240) return false
  if (value.startsWith('/') || value.includes('..') || value.includes('\\')) return false
  return value.endsWith('.json')
}
