let lastOffset = 0
let lastQuery = ''

export function rememberProductHubOffset(offset: number): void {
  lastOffset = offset
}

export function consumeProductHubOffset(): number {
  return lastOffset
}

export function rememberProductHubQuery(query: string): void {
  lastQuery = query
}

export function consumeProductHubQuery(): string {
  return lastQuery
}
