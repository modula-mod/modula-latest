import {sql} from 'kysely'
import type {ModulaWorkerDb} from '../database.js'

export async function pendingSearchDeliveryCount(db: ModulaWorkerDb): Promise<number> {
  const row = await db
    .selectFrom('greenfield_event_deliveries')
    .select(sql<number>`count(*)::int`.as('count'))
    .where('target_type', '=', 'search-index')
    .where('status', 'in', ['pending', 'retrying'])
    .executeTakeFirst()
  return Number(row?.count ?? 0)
}
