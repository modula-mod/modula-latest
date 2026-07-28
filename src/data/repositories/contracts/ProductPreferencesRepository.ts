export type SyncedBoardLayout = {
  boardWidgetIds: string[]
  version: number
  updatedAt: string
}

export type UpdateBoardLayoutInput = {
  boardWidgetIds: string[]
  expectedVersion?: number
}

export interface ProductPreferencesRepository {
  getBoardLayout(): Promise<SyncedBoardLayout>
  updateBoardLayout(input: UpdateBoardLayoutInput): Promise<SyncedBoardLayout>
}
