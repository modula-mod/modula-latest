import type {ProfileLink} from '@/features/profile/contracts/profile'

export type ValidationResult =
  | {valid: true}
  | {
      valid: false
      message: string
    }

const HANDLE_PATTERN = /^[a-z0-9._]+$/

export function validateDisplayName(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed.length) {
    return {valid: false, message: 'Display name is required.'}
  }
  if (trimmed.length > 50) {
    return {valid: false, message: 'Display name must be 50 characters or fewer.'}
  }
  return {valid: true}
}

export function normaliseHandle(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '')
}

export function validateHandle(value: string): ValidationResult {
  const normalised = normaliseHandle(value)
  if (normalised.length < 3) {
    return {valid: false, message: 'Handle must be at least 3 characters.'}
  }
  if (normalised.length > 30) {
    return {valid: false, message: 'Handle must be 30 characters or fewer.'}
  }
  if (!HANDLE_PATTERN.test(normalised)) {
    return {
      valid: false,
      message: 'Use lowercase letters, numbers, periods, or underscores only.',
    }
  }
  return {valid: true}
}

export function validateBio(value: string): ValidationResult {
  if (value.length > 160) {
    return {valid: false, message: 'Biography must be 160 characters or fewer.'}
  }
  return {valid: true}
}

export function normaliseWebsite(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.length) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function validateWebsite(value: string): ValidationResult {
  const normalised = normaliseWebsite(value)
  if (!normalised.length) return {valid: true}
  try {
    const url = new URL(normalised)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {valid: false, message: 'Website must use http:// or https://.'}
    }
    if (!url.hostname.includes('.')) {
      return {valid: false, message: 'Enter a valid website domain.'}
    }
    return {valid: true}
  } catch {
    return {valid: false, message: 'Enter a valid website URL.'}
  }
}

export function validateProfileLink(link: Pick<ProfileLink, 'label' | 'url'>): ValidationResult {
  if (!link.label.trim()) {
    return {valid: false, message: 'Link label is required.'}
  }
  return validateWebsite(link.url)
}
