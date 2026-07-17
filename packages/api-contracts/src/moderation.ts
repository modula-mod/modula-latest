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

export type ReportTargetType = 'profile' | 'post' | 'message' | 'other'

export type ReportCategory = 'spam' | 'harassment' | 'impersonation' | 'illegal-content' | 'privacy' | 'other'

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

export type CreateReportInput = {
  targetType: ReportTargetType
  targetId: string
  category: ReportCategory
  details?: string
}

export type ReportDto = {
  id: string
  targetType: ReportTargetType
  targetId: string
  category: ReportCategory
  details: string
  status: ReportStatus
  createdAt: string
}
