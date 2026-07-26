import {asNumber, asRecord, asString} from '@/api/decoding/validation'
import type {ApiClient} from '@/api/client'
import type {
  ProductPreferencesRepository,
  SyncedBoardLayout,
  UpdateBoardLayoutInput,
} from '@/data/repositories/contracts'

function decodeBoardLayout(value: unknown): SyncedBoardLayout {
  const record = asRecord(value, 'board layout')
  const ids = Array.isArray(record.boardWidgetIds)
    ? record.boardWidgetIds.filter((item): item is string => typeof item === 'string')
    : []
  return {
    boardWidgetIds: ids,
    version: asNumber(record.version, 'board layout version'),
    updatedAt: asString(record.updatedAt, 'board layout updatedAt'),
  }
}

export class ApiProductPreferencesRepository implements ProductPreferencesRepository {
  constructor(private readonly client: ApiClient) {}

  getBoardLayout(): Promise<SyncedBoardLayout> {
    return this.client.get({path: '/v1/board/layout', authenticated: true}, decodeBoardLayout)
  }

  updateBoardLayout(input: UpdateBoardLayoutInput): Promise<SyncedBoardLayout> {
    return this.client.patch(
      {path: '/v1/board/layout', body: input, authenticated: true},
      decodeBoardLayout,
    )
  }
}
