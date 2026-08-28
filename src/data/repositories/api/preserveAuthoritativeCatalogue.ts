export async function preserveAuthoritativeCatalogue<T, TEnrichment>(
  authoritative: readonly T[],
  loadEnrichment: () => Promise<readonly TEnrichment[]>,
  merge: (items: readonly T[], enrichment: readonly TEnrichment[]) => T[],
): Promise<T[]> {
  try {
    return merge(authoritative, await loadEnrichment())
  } catch {
    return [...authoritative]
  }
}
