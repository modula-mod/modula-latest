export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return []
  return Array.from(new Set(Array.from(text.matchAll(/(^|\s)#([\p{L}\p{N}_-]{1,80})/gu)).map(match => match[2]!.toLowerCase())))
}
