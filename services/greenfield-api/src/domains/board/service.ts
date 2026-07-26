import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {AuditRepository} from '../audit/repository.js'

export type BoardLayoutDto = {
  boardWidgetIds: string[]
  version: number
  updatedAt: string
}

export type BoardLayoutPatch = {
  boardWidgetIds?: unknown
  expectedVersion?: number
}

const DEFAULT_BOARD_WIDGET_IDS = [
  'vault-notes',
  'product-hub',
  'saved',
  'profile',
  'settings',
  'activity',
]

function sanitizeBoardWidgetIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw Object.assign(new Error('boardWidgetIds must be an array'), {code: 'VALIDATION_FAILED'})
  const ids: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') throw Object.assign(new Error('boardWidgetIds must contain strings'), {code: 'VALIDATION_FAILED'})
    const id = item.trim()
    if (!id || id.length > 80 || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    if (ids.length >= 48) break
  }
  return ids
}

function mapBoardLayout(row: Database['greenfield_board_layouts']): BoardLayoutDto {
  return {
    boardWidgetIds: Array.isArray(row.board_widget_ids)
      ? row.board_widget_ids.filter((item): item is string => typeof item === 'string')
      : [...DEFAULT_BOARD_WIDGET_IDS],
    version: row.version,
    updatedAt: row.updated_at.toISOString(),
  }
}

export class BoardLayoutService {
  constructor(private readonly db: ModulaDb) {}

  async get(accountId: string): Promise<BoardLayoutDto> {
    let row = await this.db
      .selectFrom('greenfield_board_layouts')
      .selectAll()
      .where('account_id', '=', accountId)
      .executeTakeFirst()
    if (!row) {
      await this.db
        .insertInto('greenfield_board_layouts')
        .values({
          account_id: accountId,
          board_widget_ids: [...DEFAULT_BOARD_WIDGET_IDS],
          version: 1,
          updated_at: new Date(),
        })
        .execute()
      row = await this.db
        .selectFrom('greenfield_board_layouts')
        .selectAll()
        .where('account_id', '=', accountId)
        .executeTakeFirstOrThrow()
    }
    return mapBoardLayout(row)
  }

  async patch(accountId: string, patch: BoardLayoutPatch): Promise<BoardLayoutDto> {
    const current = await this.get(accountId)
    if (patch.expectedVersion !== undefined && patch.expectedVersion !== current.version) {
      throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    }
    const boardWidgetIds =
      patch.boardWidgetIds === undefined
        ? current.boardWidgetIds
        : sanitizeBoardWidgetIds(patch.boardWidgetIds)
    const now = new Date()
    const updated = await this.db
      .updateTable('greenfield_board_layouts')
      .set({
        board_widget_ids: boardWidgetIds,
        version: current.version + 1,
        updated_at: now,
      })
      .where('account_id', '=', accountId)
      .where('version', '=', current.version)
      .executeTakeFirst()
    if (!Number(updated.numUpdatedRows)) throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    await new AuditRepository(this.db).append(
      'board.layout.updated',
      {boardWidgetIds},
      {type: 'greenfield_board_layout', id: accountId, actorId: null},
    )
    return this.get(accountId)
  }
}
