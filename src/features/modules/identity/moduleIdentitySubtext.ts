/**
 * Founder mockup FM-MODULE-ID-001 — module identity subtext under product name.
 * Prefer short form `shortId@version` on dense cards; full `moduleId@version` on detail.
 */
export function moduleIdentitySubtext(
  moduleId: string,
  version: string | null | undefined,
  options?: {compact?: boolean},
): string {
  const ver = (version ?? '').trim() || '—'
  if (options?.compact) {
    const shortId = moduleId.includes('.') ? moduleId.split('.').pop()! : moduleId
    return `${shortId}@${ver}`
  }
  return `${moduleId}@${ver}`
}

export function formatVaultNotesIdentity(version: string | null | undefined, compact = false): string {
  return moduleIdentitySubtext('digital.modula.vault-notes', version, {compact})
}
