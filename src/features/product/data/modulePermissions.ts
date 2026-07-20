export type PermissionRisk = 'low' | 'medium' | 'high'

export type ModulePermissionDef = {
  id: string
  label: string
  description: string
  risk: PermissionRisk
  userVisible: string
}

/** Canonical permission catalogue for Forge + Standards. */
export const MODULE_PERMISSION_CATALOGUE: ModulePermissionDef[] = [
  {
    id: 'storage:namespaced',
    label: 'Namespaced storage',
    description: 'Read/write only within the module’s storage prefix.',
    risk: 'low',
    userVisible: 'Save data for this module only',
  },
  {
    id: 'profile:read',
    label: 'Profile read',
    description: 'Read public profile fields the owner shares with modules.',
    risk: 'low',
    userVisible: 'See your public profile basics',
  },
  {
    id: 'board:write',
    label: 'Board write',
    description: 'Add or update Board cards/widgets contributed by this module.',
    risk: 'medium',
    userVisible: 'Place cards on your Board',
  },
  {
    id: 'notifications:opt-in',
    label: 'Notifications (opt-in)',
    description: 'Send notifications only after the user enables them.',
    risk: 'medium',
    userVisible: 'Send optional notifications',
  },
  {
    id: 'network:declared',
    label: 'Declared network',
    description: 'Call only hosts listed in the manifest network allowlist.',
    risk: 'medium',
    userVisible: 'Connect to listed services',
  },
  {
    id: 'composer:tool',
    label: 'Composer tool',
    description: 'Register a tool in the Composer drawer.',
    risk: 'medium',
    userVisible: 'Add a Compose tool',
  },
  {
    id: 'automation:node',
    label: 'Automation node',
    description: 'Register trigger/action nodes — runner still requires user enable.',
    risk: 'medium',
    userVisible: 'Suggest automation steps',
  },
  {
    id: 'agent:scope',
    label: 'Agent scope',
    description: 'Request Gaia agent scopes — never silent private-module access.',
    risk: 'high',
    userVisible: 'Use AI agents with your approval',
  },
  {
    id: 'contacts:read',
    label: 'Contacts read',
    description: 'Read CRM/contact records the user grants.',
    risk: 'high',
    userVisible: 'Read contacts you allow',
  },
  {
    id: 'files:read',
    label: 'Files read',
    description: 'Read files from the Files module namespace when granted.',
    risk: 'high',
    userVisible: 'Read files you allow',
  },
]

export const RISK_LABEL: Record<PermissionRisk, string> = {
  low: 'Low risk',
  medium: 'Needs review',
  high: 'Sensitive',
}

export type SecurityScanFinding = {
  id: string
  severity: PermissionRisk
  title: string
  body: string
}

/** Deterministic Preview scan — not a real CVE scanner. */
export function runPermissionsSecurityScan(permissions: string[]): SecurityScanFinding[] {
  const findings: SecurityScanFinding[] = []
  const set = new Set(permissions)

  if (set.has('agent:scope') && !set.has('storage:namespaced')) {
    findings.push({
      id: 'agent-without-storage',
      severity: 'medium',
      title: 'Agent scope without storage namespace',
      body: 'Agents should still declare namespaced storage for draft artefacts.',
    })
  }
  if (set.has('network:declared') && set.size === 1) {
    findings.push({
      id: 'network-only',
      severity: 'high',
      title: 'Network without other boundaries',
      body: 'Pair network:declared with explicit storage and a user-visible purpose.',
    })
  }
  if (set.has('contacts:read') || set.has('files:read')) {
    findings.push({
      id: 'sensitive-data',
      severity: 'high',
      title: 'Sensitive data permissions',
      body: 'Contacts/files require clear uninstall behaviour and owner-only defaults.',
    })
  }
  if (!set.has('storage:namespaced')) {
    findings.push({
      id: 'missing-storage',
      severity: 'low',
      title: 'Consider namespaced storage',
      body: 'Most modules should declare storage:namespaced even for read-only UIs.',
    })
  }
  if (findings.length === 0) {
    findings.push({
      id: 'ok-preview',
      severity: 'low',
      title: 'Preview scan — no blockers',
      body: 'Local checklist only. Registry will re-scan on publish. Not a CVE database.',
    })
  }
  return findings
}
