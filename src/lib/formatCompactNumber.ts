/**
 * Compact social counts: 0, 999, 1.2K, 12.4K, 1.1M.
 * Shared so Profile, feed, and sheets do not invent separate abbreviations.
 */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000_000) {
    return `${sign}${trimCompact(abs / 1_000_000_000)}B`
  }
  if (abs >= 1_000_000) {
    return `${sign}${trimCompact(abs / 1_000_000)}M`
  }
  if (abs >= 1000) {
    return `${sign}${trimCompact(abs / 1000)}K`
  }
  return `${sign}${Math.round(abs)}`
}

export function formatFullNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat().format(value)
}

function trimCompact(value: number): string {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 1
  const fixed = value.toFixed(digits)
  return fixed.replace(/\.0$/, '')
}
