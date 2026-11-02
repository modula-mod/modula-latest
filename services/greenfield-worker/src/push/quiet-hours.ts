export interface QuietHours {
  enabled: boolean
  start: string // HH:MM local
  end: string // HH:MM local
  timezone: string
}

function minutes(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function localMinutes(now: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(now)
    const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
    const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
    return hour * 60 + minute
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes()
  }
}

/**
 * When `now` falls inside the quiet window, returns the instant the window
 * ends (so the delivery can be deferred); otherwise null. Windows may wrap
 * midnight (22:00 -> 07:00). start === end means no window.
 */
export function quietHoursEnd(now: Date, quiet: QuietHours | null | undefined): Date | null {
  if (!quiet?.enabled) return null
  const start = minutes(quiet.start)
  const end = minutes(quiet.end)
  if (start === end) return null
  const current = localMinutes(now, quiet.timezone)
  const inside = start < end ? current >= start && current < end : current >= start || current < end
  if (!inside) return null
  const wait = (end - current + 24 * 60) % (24 * 60)
  const resume = new Date(now.getTime() + wait * 60_000)
  resume.setUTCSeconds(0, 0)
  return resume
}
