import type {CreateReportInput, ReportDto} from '@modula/api-contracts'
import {asRecord} from '@/api/decoding/validation'
import type {ApiClient} from '@/api/client'
import type {ProfileId} from '@/api/contracts'
import type {
  BlockResult,
  ModerationRepository,
  MuteResult,
} from '@/data/repositories/contracts/ModerationRepository'

function decodeBlockResult(value: unknown): BlockResult {
  const result = asRecord(value, 'block result')
  return {blocked: Boolean(result.blocked)}
}

function decodeMuteResult(value: unknown): MuteResult {
  const result = asRecord(value, 'mute result')
  return {muted: Boolean(result.muted)}
}

function decodeReport(value: unknown): ReportDto {
  const result = asRecord(value, 'report')
  return {
    id: String(result.id),
    targetType: result.targetType as ReportDto['targetType'],
    targetId: String(result.targetId),
    category: result.category as ReportDto['category'],
    details: String(result.details ?? ''),
    status: result.status as ReportDto['status'],
    createdAt: String(result.createdAt),
  }
}

export class ApiModerationRepository implements ModerationRepository {
  constructor(private readonly client: ApiClient) {}

  blockProfile(profileId: ProfileId): Promise<BlockResult> {
    return this.client.post(
      {
        path: `/v1/profiles/${encodeURIComponent(profileId)}/block`,
        body: {},
        authenticated: true,
      },
      decodeBlockResult,
    )
  }

  unblockProfile(profileId: ProfileId): Promise<BlockResult> {
    return this.client.delete(
      {
        path: `/v1/profiles/${encodeURIComponent(profileId)}/block`,
        body: {},
        authenticated: true,
      },
      decodeBlockResult,
    )
  }

  muteProfile(profileId: ProfileId): Promise<MuteResult> {
    return this.client.post(
      {
        path: `/v1/profiles/${encodeURIComponent(profileId)}/mute`,
        body: {},
        authenticated: true,
      },
      decodeMuteResult,
    )
  }

  unmuteProfile(profileId: ProfileId): Promise<MuteResult> {
    return this.client.delete(
      {
        path: `/v1/profiles/${encodeURIComponent(profileId)}/mute`,
        body: {},
        authenticated: true,
      },
      decodeMuteResult,
    )
  }

  createReport(input: CreateReportInput): Promise<ReportDto> {
    return this.client.post(
      {path: '/v1/reports', body: input, authenticated: true},
      decodeReport,
    )
  }
}
