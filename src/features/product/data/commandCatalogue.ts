export type CommandRisk = 'low' | 'medium' | 'high'

export type ModulaCommand = {
  id: string
  label: string
  description: string
  note?: string
  risk: CommandRisk
  confirmation: 'none' | 'preview' | 'explicit'
  permissions: string[]
  undo: string
}

export const COMMAND_CATALOGUE: ModulaCommand[] = [
  {
    id: 'notes.create',
    label: 'Create note',
    description: 'Create a private note from context or chat.',
    risk: 'low',
    confirmation: 'preview',
    permissions: ['storage:namespaced'],
    undo: 'Delete draft note',
  },
  {
    id: 'tasks.create',
    label: 'Create task',
    description: 'Turn a conversation or post into a task.',
    risk: 'low',
    confirmation: 'preview',
    permissions: ['storage:namespaced', 'board:write'],
    undo: 'Archive task',
  },
  {
    id: 'crm.contact.update',
    label: 'Update CRM contact',
    description: 'Update a lead or contact field.',
    risk: 'medium',
    confirmation: 'explicit',
    permissions: ['contacts:read', 'storage:namespaced'],
    undo: 'Revert field change',
  },
  {
    id: 'messaging.send',
    label: 'Send message',
    description: 'Send a DM or team message.',
    risk: 'high',
    confirmation: 'explicit',
    permissions: ['network:declared'],
    undo: 'Not always reversible — Soft recall where supported',
  },
  {
    id: 'focus.start',
    label: 'Start Focus',
    description: 'Begin Light, Deep, or Custom Focus session.',
    risk: 'low',
    confirmation: 'preview',
    permissions: [],
    undo: 'focus.stop',
  },
  {
    id: 'focus.stop',
    label: 'Stop Focus',
    description: 'End the active Focus session.',
    risk: 'low',
    confirmation: 'none',
    permissions: [],
    undo: 'Restore previous session if scheduled',
  },
  {
    id: 'privacy.setLevel',
    label: 'Set Glass Privacy',
    description: 'Disable Sharing / Protected Chat / Vault Chat.',
    risk: 'medium',
    confirmation: 'explicit',
    permissions: [],
    undo: 'Restore previous level',
  },
  {
    id: 'board.addWidget',
    label: 'Add Board widget',
    description: 'Place a module widget on Board.',
    risk: 'low',
    confirmation: 'preview',
    permissions: ['board:write'],
    undo: 'Remove widget',
  },
  {
    id: 'module.install',
    label: 'Install module',
    description: 'Install from Registry after AKI scan.',
    risk: 'high',
    confirmation: 'explicit',
    permissions: ['network:declared'],
    undo: 'module.disable / uninstall',
  },
  {
    id: 'module.disable',
    label: 'Disable module',
    description: 'Disable without purge.',
    risk: 'medium',
    confirmation: 'explicit',
    permissions: [],
    undo: 'Re-enable',
  },
  {
    id: 'dimon.transfer',
    label: 'DIMON transfer',
    description: 'Reserved — DIMON is not active yet.',
    note: 'Preview blocked while DIMON is inactive.',
    risk: 'high',
    confirmation: 'explicit',
    permissions: ['dimon:transaction:request'],
    undo: 'Blocked while DIMON inactive',
  },
  {
    id: 'dimon.asset.transfer',
    label: 'Transfer digital ownership asset',
    description: 'Reserved NFT / digital ownership transfer request. DIMON is not active yet.',
    note: 'Preview blocked: no mint, transfer, wallet, or chain operation is available.',
    risk: 'high',
    confirmation: 'explicit',
    permissions: ['dimon:asset:transfer:request'],
    undo: 'Blocked while DIMON inactive',
  },
]
