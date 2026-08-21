export type PermissionAudience = 'user' | 'technical'

export type ModulePermissionInput = {
  permission: string
  reason: string
  risk?: 'low' | 'medium' | 'high' | 'restricted'
}

export type UserFacingPermissionGroup = {
  id: string
  section: 'YOUR DATA' | 'MODULA INTEGRATION'
  title: string
  summary: string
  permissions: ModulePermissionInput[]
}

export type PermissionPresentation = {
  groups: UserFacingPermissionGroup[]
  technical: ModulePermissionInput[]
  complexity: 'simple' | 'complex'
  accessSummary: string
}

const TECHNICAL_PATTERN =
  /register |schema|route|function|manifest|capability identifier|contract|checksum|engine|lexicon/i

function classifyPermission(permission: ModulePermissionInput): PermissionAudience {
  const text = `${permission.permission} ${permission.reason}`
  return TECHNICAL_PATTERN.test(text) ? 'technical' : 'user'
}

function groupIdFor(permission: ModulePermissionInput): UserFacingPermissionGroup['id'] {
  const text = `${permission.permission} ${permission.reason}`.toLowerCase()
  if (/search/.test(text)) return 'search'
  if (/profile|tab/.test(text)) return 'profile'
  if (/composer|quick action|save to vault|integration|surface/.test(text)) return 'integrations'
  if (/folder|note|record|document|knowledge/.test(text)) return 'notes'
  return 'other'
}

const GROUP_META: Record<
  string,
  {section: UserFacingPermissionGroup['section']; title: string; summary: string}
> = {
  notes: {
    section: 'YOUR DATA',
    title: 'Notes & folders',
    summary: 'Create, organise and remove the notes and folders you make here.',
  },
  search: {
    section: 'YOUR DATA',
    title: 'Search',
    summary: 'Search records that belong to this module.',
  },
  integrations: {
    section: 'MODULA INTEGRATION',
    title: 'Modula integration',
    summary: 'Add declared actions to supported Modula surfaces.',
  },
  profile: {
    section: 'MODULA INTEGRATION',
    title: 'Profile integration',
    summary: 'Optional private profile surface, off by default.',
  },
  other: {
    section: 'YOUR DATA',
    title: 'Module data',
    summary: 'Create and manage records this module stores for you.',
  },
}

export function presentPermissions(
  permissions: ModulePermissionInput[] | undefined,
  productName = 'This module',
): PermissionPresentation {
  const items = permissions ?? []
  const technical = items.filter(item => classifyPermission(item) === 'technical')
  const userFacing = items.filter(item => classifyPermission(item) === 'user')
  const grouped = new Map<string, UserFacingPermissionGroup>()

  for (const permission of userFacing) {
    const id = groupIdFor(permission)
    const existing = grouped.get(id)
    if (existing) {
      existing.permissions.push(permission)
      continue
    }
    const meta = GROUP_META[id] ?? GROUP_META.other
    grouped.set(id, {
      id,
      section: meta.section,
      title: meta.title,
      summary: meta.summary,
      permissions: [permission],
    })
  }

  if (!userFacing.length && technical.length) {
    const technicalText = technical.map(item => `${item.permission} ${item.reason}`).join(' ').toLowerCase()
    const inferredIds = [
      /note|folder|record|document|schema/.test(technicalText) ? 'notes' : null,
      /search/.test(technicalText) ? 'search' : null,
      /profile|tab|composer|surface|integration/.test(technicalText) ? 'integrations' : null,
    ].filter((id): id is string => Boolean(id))
    for (const id of inferredIds) {
      const meta = GROUP_META[id] ?? GROUP_META.other
      grouped.set(id, {id, ...meta, permissions: []})
    }
  }

  if (!grouped.size) {
    grouped.set('notes', {
      id: 'notes',
      ...GROUP_META.notes,
      permissions: [],
    })
  }

  const groups = [...grouped.values()]
  const complexity: PermissionPresentation['complexity'] =
    technical.length > 3 || items.length > 6 ? 'complex' : 'simple'

  return {
    groups,
    technical,
    complexity,
    accessSummary: `${productName} stores its records inside your Modula account.`,
  }
}

export function permissionDetent(presentation: PermissionPresentation): 'medium' | 'large' {
  return presentation.complexity === 'complex' ? 'large' : 'medium'
}
