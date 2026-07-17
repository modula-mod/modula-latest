import type {GreenfieldExtensionTrust} from '@modula/greenfield-contracts'

export type {GreenfieldExtensionTrust}

/**
 * Phase 6R execution policy:
 * - firstParty: may execute trusted packaged code
 * - verifiedPublisher: reviewed remote functions / signed packages later
 * - reviewedCommunity: manifest/metadata only until manually approved
 * - untrustedManifest: discovery only, no execution
 */
export function trustAllowsExecution(trust: GreenfieldExtensionTrust): boolean {
  return trust === 'firstParty' || trust === 'verifiedPublisher'
}

export function trustAllowsInstall(trust: GreenfieldExtensionTrust): boolean {
  return trust !== 'untrustedManifest'
}

export function assertTrustedExtension(status: string): void {
  // Published first-party / verified versions may install; drafts and untrusted cannot execute.
  if (status !== 'published' && status !== 'firstParty') {
    throw Object.assign(new Error('Extension version is not trusted for installation'), {code: 'FORBIDDEN'})
  }
}

export function assertNoArbitraryCodeExecution(manifest: {entrypoints?: Array<{target?: string}>}): void {
  for (const entry of manifest.entrypoints ?? []) {
    const target = entry.target ?? ''
    if (
      target.includes('eval(') ||
      target.includes('new Function') ||
      target.startsWith('javascript:') ||
      target.includes('child_process')
    ) {
      throw Object.assign(new Error('Arbitrary code execution is not permitted'), {code: 'FORBIDDEN'})
    }
  }
}
