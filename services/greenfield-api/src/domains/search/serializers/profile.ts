export function profileKeywordSet(handle: string, displayName: string, tags: string[] = []): string[] {
  return Array.from(new Set([handle.toLowerCase(), displayName.toLowerCase(), ...tags.map(tag => tag.toLowerCase())].filter(Boolean)))
}
