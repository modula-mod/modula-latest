export function moduleKeywordSet(input: {moduleId: string; name: string; publisher?: string; capabilities?: string[]}): string[] {
  return Array.from(new Set([input.moduleId, input.name, input.publisher, ...(input.capabilities ?? [])].filter(Boolean).map(item => item!.toLowerCase())))
}
