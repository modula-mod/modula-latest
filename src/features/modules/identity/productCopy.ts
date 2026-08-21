import {moduleArtworkPack} from '@/features/modules/identity/moduleArtwork'

const ENGINEERING_COPY =
  /\b(first-?party|greenfield-managed|greenfield|kind_sections|module standard|manifest capability|contract-only|debug)\b/gi

const KNOWN_COPY: Record<
  string,
  {eyebrow?: string; tagline: string; short: string; description: string; whatItDoes: string; privacy: string}
> = {
  'digital.modula.vault-notes': {
    eyebrow: 'Private by design',
    tagline: 'Your knowledge, kept yours.',
    short: 'Private notes and knowledge',
    description: 'Private notes and knowledge, built into Modula.',
    whatItDoes: 'Keep thoughts, links and information inside your private Vault.',
    privacy: 'Your Vault Notes records are private to your account.',
  },
  'digital.modula.tasks': {
    eyebrow: 'Coming to Modula',
    tagline: 'Quiet lists for work that has to ship.',
    short: 'Quiet lists that have to ship',
    description: 'Tasks is coming to Modula. Lists stay on your account.',
    whatItDoes: 'Capture work that has to ship without scattering it across other apps.',
    privacy: 'When it ships, your lists remain account-scoped.',
  },
}

export function sanitizeProductCopy(raw: string | undefined | null): string {
  if (!raw) return ''
  return raw.replace(ENGINEERING_COPY, '').replace(/\s{2,}/g, ' ').replace(/^[\s.,;:—-]+/, '').trim()
}

export function productCopyFor(moduleId: string, fallbackName?: string, fallbackDescription?: string) {
  const known = KNOWN_COPY[moduleId]
  const pack = moduleArtworkPack(moduleId, fallbackName)
  const cleaned = sanitizeProductCopy(fallbackDescription)
  return {
    name: pack.name,
    publisher: pack.publisher,
    eyebrow: known?.eyebrow,
    tagline: known?.tagline ?? pack.tagline,
    short: known?.short ?? (pack.tagline || cleaned),
    description: known?.description ?? (cleaned || pack.tagline),
    whatItDoes: known?.whatItDoes ?? (cleaned || pack.tagline),
    privacy: known?.privacy ?? 'Your data remains account-scoped.',
  }
}

export function isEngineeringCopy(value: string): boolean {
  return /\b(first-?party|greenfield-managed|greenfield|kind_sections|module standard|manifest capability|contract-only|debug)\b/i.test(
    value,
  )
}
