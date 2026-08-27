import type {ModulaProfileDto} from './profiles.js'

export type BlockDto = {
  id: string
  blocked: ModulaProfileDto
  createdAt: string
}

export type MuteDto = {
  id: string
  muted: ModulaProfileDto
  createdAt: string
}

export type ReportTargetType = 'profile' | 'post' | 'comment' | 'story' | 'message' | 'other'

export type ReportCategory = 'spam' | 'harassment' | 'impersonation' | 'illegal-content' | 'privacy' | 'other'

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

export type CreateReportInput = {
  targetType: ReportTargetType
  targetId: string
  category: ReportCategory
  details?: string
  evidenceRefs?: ReportEvidenceReference[]
}

export type ReportEvidenceReference = {
  kind: 'asset' | 'record' | 'url'
  reference: string
}

export type ReportDto = {
  id: string
  targetType: ReportTargetType
  targetId: string
  category: ReportCategory
  details: string
  status: ReportStatus
  evidenceRefs?: ReportEvidenceReference[]
  reviewedByActorId?: string | null
  reviewedAt?: string | null
  resolution?: string | null
  version?: number
  createdAt: string
}

export type ModerationActionType = 'warning_recorded' | 'content_removed' | 'no_action'
