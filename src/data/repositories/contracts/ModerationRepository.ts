import type {CreateReportInput, ReportDto} from '@modula/api-contracts'
import type {ProfileId} from '@/api/contracts'

export type BlockResult = {blocked: boolean}
export type MuteResult = {muted: boolean}

export interface ModerationRepository {
  blockProfile(profileId: ProfileId): Promise<BlockResult>
  unblockProfile(profileId: ProfileId): Promise<BlockResult>
  muteProfile(profileId: ProfileId): Promise<MuteResult>
  unmuteProfile(profileId: ProfileId): Promise<MuteResult>
  createReport(input: CreateReportInput): Promise<ReportDto>
}
