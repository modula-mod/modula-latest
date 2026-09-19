import type {EvidenceReference, EvidenceState} from './domain.js'

export function evidenceState(references: readonly EvidenceReference[], required = false): EvidenceState {
  if (references.length === 0) return required ? 'INSUFFICIENT_EVIDENCE' : 'NO_EVIDENCE'
  const identities = new Set<string>()
  for (const reference of references) {
    if (!reference.id || (reference.kind === 'derived' && !reference.sourceId && !reference.hash)) return 'INSUFFICIENT_EVIDENCE'
    const identity = `${reference.kind}:${reference.sourceId ?? reference.uri ?? reference.hash ?? reference.id}`
    if (identities.has(identity)) continue
    identities.add(identity)
  }
  return 'EVIDENCE_PRESENT'
}
