/**
 * Human-relative timestamps for Activity, feeds, and Board.
 * Accepts ISO strings; returns a short label. Invalid input → "Recently".
 */
export function formatRelativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) return 'Recently'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    // Already humanised, or opaque label from an upstream mapper.
    if (/^\d+[mhd]$|^Now$|^Recently$/i.test(value.trim())) return value
    return 'Recently'
  }
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000))
  if (minutes < 1) return 'Now'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h`
  if (minutes < 10_080) return `${Math.floor(minutes / 1_440)}d`
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
