import type {AppIconName} from '@/components/primitives/AppIcon'

export type IntelligenceLayerId =
  | 'gaia'
  | 'aki'
  | 'governor'
  | 'circuit-memory'
  | 'kaizen'
  | 'foundry'
  | 'claims-graph'
  | 'ledger'
  | 'commands'
  | 'forge'
  | 'gaia-atlas'

export type IntelligenceLayer = {
  id: IntelligenceLayerId
  name: string
  role: string
  interpretation: string
  icon: AppIconName
  route: string
  maturity: 'preview' | 'planned' | 'inactive'
  responsibilities: string[]
  mustNot: string[]
  mvp: string[]
}

/**
 * Canonical intelligence layers — GAIA executes, AKI verifies, Governor controls.
 */
export const INTELLIGENCE_LAYERS: IntelligenceLayer[] = [
  {
    id: 'gaia',
    name: 'GAIA',
    role: 'Context, interaction and execution',
    interpretation: 'The intelligence users work with',
    icon: 'automation',
    route: '/product/gaia',
    maturity: 'preview',
    responsibilities: [
      'Understand user, screen, modules, Focus, privacy',
      'Propose and (later) execute commands via Command Layer',
      'Board briefing, Chat-to-Note / Chat-to-Task',
      'Clear action previews before execution',
    ],
    mustNot: [
      'Unrestricted access to every surface',
      'Silent private-module reads',
      'Autonomous send/publish without confirmation (MVP)',
    ],
    mvp: [
      'Screen-aware assistance',
      'Read-only summaries',
      'Suggested commands',
      'User-confirmed module actions',
      'Search across permitted data',
    ],
  },
  {
    id: 'aki',
    name: 'AKI',
    role: 'Verification, evidence and forensic reasoning',
    interpretation: 'The system that checks GAIA',
    icon: 'security',
    route: '/product/aki',
    maturity: 'planned',
    responsibilities: [
      'Claim verification (evidence, confidence, provenance)',
      'Action verification before sensitive commands',
      'Module verification at submit / update',
      'Forensic investigation of failures',
    ],
    mustNot: ['Be skipped for consequential actions', 'Invent evidence'],
    mvp: [
      'Action risk preview',
      'Permission conflict flags',
      'Manifest permission scan (Preview)',
      'Explain why an action would be rejected',
    ],
  },
  {
    id: 'governor',
    name: 'AGI Governor',
    role: 'Goals, permissions, orchestration and governance',
    interpretation: 'The authority above the agents',
    icon: 'settings',
    route: '/product/governor',
    maturity: 'planned',
    responsibilities: [
      'Choose agent/model for a request',
      'Autonomy levels and approval gates',
      'Compute / spending limits',
      'Pause or isolate failing capabilities',
      'Control which models enter production',
    ],
    mustNot: [
      'Be marketed as “human-level AGI”',
      'Bypass AKI for sensitive actions',
    ],
    mvp: [
      'Autonomy presets (suggest / confirm / restricted)',
      'Policy cards for send, install, export',
      'Pause GAIA interruptions under Deep Focus',
    ],
  },
  {
    id: 'circuit-memory',
    name: 'Circuit Memory',
    role: 'Private, structured long-term memory',
    interpretation: 'The system’s learned muscle memory',
    icon: 'saved',
    route: '/product/circuit-memory',
    maturity: 'preview',
    responsibilities: [
      'Isolated encrypted per-user namespaces',
      'Approved workflows and preferences',
      'Validated patterns (AKI-approved)',
      'Memory Centre: inspect, edit, export, delete',
    ],
    mustNot: [
      'One global memory of all users',
      'Store every raw conversation forever by default',
      'Retain unvalidated AI claims',
    ],
    mvp: [
      'Session / user / module memory levels (Preview)',
      'List retained patterns locally',
      'Delete / export controls',
    ],
  },
  {
    id: 'kaizen',
    name: 'Kaizen',
    role: 'Continuous product and intelligence improvement',
    interpretation: 'The improvement engine',
    icon: 'motion',
    route: '/product/kaizen',
    maturity: 'preview',
    responsibilities: [
      'Capture Improve feedback from UI',
      'Classify, cluster, investigate',
      'Propose versioned improvements',
      'Verify → approve → release → observe → rollback',
    ],
    mustNot: ['Silently rewrite production code', 'Ship without human release control'],
    mvp: [
      'Improve capture sheet (Preview)',
      'Review queue list',
      'Classification chips',
    ],
  },
  {
    id: 'foundry',
    name: 'Foundry',
    role: 'Data preparation, training, evaluation and promotion',
    interpretation: 'The model-development factory',
    icon: 'tools',
    route: '/product/foundry',
    maturity: 'planned',
    responsibilities: [
      'Discover → repair → ingest → curate → assemble datasets',
      'Human review packs',
      'Train one controlled student model',
      'Evaluate and promote only after gates',
    ],
    mustNot: ['Train before provenance and evaluation gates exist'],
    mvp: [
      'Pipeline schematic',
      'Dataset version placeholders',
      'Promotion gate checklist (all blocked until real)',
    ],
  },
  {
    id: 'claims-graph',
    name: 'Claims Graph',
    role: 'Evidence-backed knowledge relationships',
    interpretation: 'The organised map of what is believed',
    icon: 'link',
    route: '/product/claims-graph',
    maturity: 'planned',
    responsibilities: [
      'Store claims with evidence and confidence',
      'Track contradictions and expiration',
      'Distinguish facts, preferences, inferences',
    ],
    mustNot: ['Treat model prose as confirmed fact'],
    mvp: ['Sample claim cards', 'Status filters', 'Link to AKI'],
  },
  {
    id: 'ledger',
    name: 'Ledger & Replay',
    role: 'Auditable record of actions and decisions',
    interpretation: 'The system’s black box recorder',
    icon: 'storage',
    route: '/product/ledger',
    maturity: 'preview',
    responsibilities: [
      'Record initiator, commands, permissions, AKI, Governor, approval',
      'Side effects and rollback info',
      'Replay for diagnostics without destructive re-run',
    ],
    mustNot: ['Hide consequential AI actions from the user'],
    mvp: ['Seeded ledger rows (Preview)', 'Detail drawer', 'Replay explanation'],
  },
  {
    id: 'commands',
    name: 'Command Layer',
    role: 'Common execution router',
    interpretation: 'Bridge between UI, AI and modules',
    icon: 'developer',
    route: '/product/commands',
    maturity: 'preview',
    responsibilities: [
      'Route Search, Start, GAIA, Composer, Automations, deep links',
      'Typed inputs, risk, preview, confirmation, undo',
      'Ledger policy per command',
    ],
    mustNot: ['Hardcode one-off execution paths per surface'],
    mvp: [
      'Command catalogue Preview',
      'Risk + confirmation badges',
      'Deep link to Focus / Notes-shaped actions',
    ],
  },
  {
    id: 'forge',
    name: 'Module Forge',
    role: 'Creation and publication of modules',
    interpretation: 'Modula’s developer construction system',
    icon: 'developer',
    route: '/product/forge',
    maturity: 'preview',
    responsibilities: [
      'Templates, manifests, permissions, skill.md',
      'Package → Registry scan → Marketplace',
      'Command + AI action registration',
    ],
    mustNot: ['Execute untrusted GitHub code in host', 'Fake publish success'],
    mvp: ['Plan/Build/Preview/Manifest workspace', 'Permission scan', 'skill.md template'],
  },
  {
    id: 'gaia-atlas',
    name: 'Gaia Atlas',
    role: 'Visual intelligence architecture',
    interpretation: 'Map of agents, claims, memory, lineage',
    icon: 'discover',
    route: '/product/gaia-atlas',
    maturity: 'planned',
    responsibilities: [
      'Visualise agents, models, modules, claims, memory paths',
      'System health and trust relationships',
    ],
    mustNot: ['Ship as consumer core before Notes/Tasks/CRM platform'],
    mvp: ['Schematic Preview', 'Links into GAIA / AKI / Governor'],
  },
]

export function getIntelligenceLayer(id: string): IntelligenceLayer | undefined {
  return INTELLIGENCE_LAYERS.find(layer => layer.id === id)
}
