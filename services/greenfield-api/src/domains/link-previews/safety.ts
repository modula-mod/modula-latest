import {isIP} from 'node:net'
import type {ModulaDb} from '../../database/client.js'
import {normaliseUrl} from './service.js'

export type LinkSafety = {level: 'ok' | 'warning' | 'blocked'; reasons: string[]; domain: string}

/** Domain-level safety verdict: moderator blocklist (domain or any parent) plus heuristics that warrant a warning. */
export async function linkSafety(db: ModulaDb, raw: unknown): Promise<LinkSafety> {
  const url = normaliseUrl(raw)
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  const labels = host.split('.')
  const candidates = labels.map((_, index) => labels.slice(index).join('.')).filter(name => name.includes('.'))
  const reasons: string[] = []
  const blocked = candidates.length
    ? await db.selectFrom('greenfield_link_blocklist').select(['domain', 'reason']).where('domain', 'in', candidates).executeTakeFirst()
    : undefined
  if (blocked) return {level: 'blocked', reasons: [blocked.reason], domain: host}
  if (url.protocol === 'http:') reasons.push('not_encrypted')
  if (isIP(host.replace(/^\[|\]$/g, ''))) reasons.push('ip_address')
  if (labels.some(label => label.startsWith('xn--'))) reasons.push('lookalike_domain')
  return {level: reasons.length ? 'warning' : 'ok', reasons, domain: host}
}
