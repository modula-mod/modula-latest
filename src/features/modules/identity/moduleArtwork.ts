export type ModuleArtworkKind =
  | 'vault-notes'
  | 'tasks'
  | 'crm'
  | 'gaia'
  | 'avatar-studio'
  | 'gubic'
  | 'fallback'

export type ModuleArtworkPack = {
  moduleId: string
  kind: ModuleArtworkKind
  name: string
  tagline: string
  publisher: string
  /** Product art colours — never the Modula OS accent unless this product owns it. */
  palette: {
    paper: string
    ink: string
    wash: string
    stitch?: string
  }
}

const PACKS: Record<string, ModuleArtworkPack> = {
  'digital.modula.vault-notes': {
    moduleId: 'digital.modula.vault-notes',
    kind: 'vault-notes',
    name: 'Vault Notes',
    tagline: 'Private notes and saved knowledge, wherever you use Modula.',
    publisher: 'Modula',
    palette: {
      paper: '#F4EDE1',
      ink: '#2A241C',
      wash: '#E4D5C1',
      stitch: '#8A6A4B',
    },
  },
  'digital.modula.tasks': {
    moduleId: 'digital.modula.tasks',
    kind: 'tasks',
    name: 'Tasks',
    tagline: 'Quiet lists for work that has to ship.',
    publisher: 'Modula',
    palette: {paper: '#EFEFEA', ink: '#1F1F1C', wash: '#D8D8D0'},
  },
  'digital.modula.crm': {
    moduleId: 'digital.modula.crm',
    kind: 'crm',
    name: 'CRM',
    tagline: 'People and correspondence, kept close.',
    publisher: 'Modula',
    palette: {paper: '#EFE8E1', ink: '#3A2A22', wash: '#D9C4B0'},
  },
  'digital.modula.gaia-atlas': {
    moduleId: 'digital.modula.gaia-atlas',
    kind: 'gaia',
    name: 'GAIA Atlas',
    tagline: 'A field of knowledge, not a globe sticker.',
    publisher: 'Modula',
    palette: {paper: '#1C2420', ink: '#E6EDE8', wash: '#2E3B34'},
  },
  'digital.modula.avatar-studio': {
    moduleId: 'digital.modula.avatar-studio',
    kind: 'avatar-studio',
    name: 'Avatar Studio',
    tagline: 'Presence you own.',
    publisher: 'Modula',
    palette: {paper: '#111111', ink: '#F2E6C9', wash: '#2A2A2A'},
  },
  'digital.modula.gubic': {
    moduleId: 'digital.modula.gubic',
    kind: 'gubic',
    name: 'Gubic',
    tagline: 'A launcher for future modules.',
    publisher: 'Modula',
    palette: {paper: '#ECEAE4', ink: '#222222', wash: '#D4D1C8'},
  },
}

export function moduleArtworkPack(moduleId: string, fallbackName?: string): ModuleArtworkPack {
  const known = PACKS[moduleId]
  if (known) return known
  return {
    moduleId,
    kind: 'fallback',
    name: fallbackName ?? moduleId,
    tagline: '',
    publisher: 'Modula',
    palette: {paper: '#E8E6E1', ink: '#2C2C2C', wash: '#D5D2CB'},
  }
}
