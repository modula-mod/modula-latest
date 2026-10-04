/**
 * GIF proxy. The provider key stays on the server (GIPHY_API_KEY in the API env);
 * clients only ever see normalised results. Without a key the proxy reports
 * itself unconfigured instead of returning placeholder content.
 */
export type GifResult = {id: string; title: string | null; url: string; previewUrl: string; width: number | null; height: number | null}

const MAX_LIMIT = 30
const notConfigured = () => Object.assign(new Error('GIF search is not configured'), {code: 'CAPABILITY_DISABLED'})
const invalid = (message: string) => Object.assign(new Error(message), {code: 'VALIDATION_FAILED'})

export class GifService {
  constructor(private readonly apiKey: string | undefined = process.env.GIPHY_API_KEY, private readonly rating = process.env.GIPHY_RATING ?? 'pg-13') {}

  get configured() { return Boolean(this.apiKey && this.apiKey.trim()) }

  async trending(limit?: unknown, offset?: unknown) {
    return this.call('trending', {}, limit, offset)
  }

  async search(query: unknown, limit?: unknown, offset?: unknown) {
    const q = typeof query === 'string' ? query.trim() : ''
    if (!q || q.length > 100) throw invalid('Search text required')
    return this.call('search', {q}, limit, offset)
  }

  private async call(kind: 'trending' | 'search', params: Record<string, string>, limit: unknown, offset: unknown) {
    if (!this.configured) throw notConfigured()
    const n = Math.min(Math.max(Number(limit) || 24, 1), MAX_LIMIT)
    const o = Math.min(Math.max(Number(offset) || 0, 0), 4999)
    const url = new URL(`https://api.giphy.com/v1/gifs/${kind}`)
    for (const [key, value] of Object.entries({...params, limit: String(n), offset: String(o), rating: this.rating, bundle: 'messaging_non_clips'})) url.searchParams.set(key, value)
    url.searchParams.set('api_key', this.apiKey!.trim())
    const response = await fetch(url, {signal: AbortSignal.timeout(5000), headers: {accept: 'application/json'}})
    if (!response.ok) throw Object.assign(new Error('GIF provider unavailable'), {code: 'SERVER_ERROR'})
    const body = await response.json() as any
    const items: GifResult[] = (Array.isArray(body?.data) ? body.data : []).flatMap((gif: any) => {
      const full = gif?.images?.fixed_height ?? gif?.images?.original
      const preview = gif?.images?.fixed_height_small ?? gif?.images?.preview_gif ?? full
      if (typeof gif?.id !== 'string' || typeof full?.url !== 'string') return []
      return [{
        id: gif.id, title: typeof gif.title === 'string' ? gif.title.slice(0, 140) : null,
        url: full.url, previewUrl: typeof preview?.url === 'string' ? preview.url : full.url,
        width: Number(full.width) || null, height: Number(full.height) || null,
      }]
    })
    const total = Number(body?.pagination?.total_count) || 0
    return {provider: 'giphy' as const, items, nextOffset: o + items.length < total ? o + items.length : null}
  }
}
