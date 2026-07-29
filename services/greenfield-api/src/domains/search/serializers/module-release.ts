export function releaseKeywordSet(input: {moduleId: string; version: string; standardVersion?: string; publisher?: string}): string[] {
  return Array.from(new Set([input.moduleId, input.version, input.standardVersion, input.publisher].filter(Boolean).map(item => item!.toLowerCase())))
}
