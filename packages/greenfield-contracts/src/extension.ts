export type GreenfieldExtensionKind =
  | 'module'
  | 'addon'
  | 'plugin'
  | 'function'
  | 'tool'
  | 'connector'
  | 'widget'
  | 'service'
  | 'engine'
  | 'game'
  | 'integration'
  | 'theme'
  | 'bridge'

export type GreenfieldExtensionProductKind = Exclude<GreenfieldExtensionKind, 'bridge'>

export type GreenfieldExtensionContributionKind =
  | 'view.section'
  | 'toolbar.action'
  | 'editor.command'
  | 'editor.attachment'
  | 'menu.item'
  | 'contextMenu.item'
  | 'settings.section'
  | 'home.section'
  | 'widget'
  | 'record.decorator'
  | 'search.provider'
  | 'composer.tool'
  | 'background.action'

export type GreenfieldExtensionLifecycleState =
  | 'NOT_INSTALLED'
  | 'RESOLVING'
  | 'INSTALLING'
  | 'INSTALLED'
  | 'ENABLING'
  | 'ENABLED'
  | 'DISABLING'
  | 'DISABLED'
  | 'UNINSTALLING'
  | 'UPDATE_AVAILABLE'
  | 'UPDATING'
  | 'INCOMPATIBLE'
  | 'QUARANTINED'
  | 'FAILED'

export type GreenfieldExtensionTarget = {
  productId: string
  versionRange: string
  requiredCapabilities: string[]
  requiredExtensionPoints: string[]
}

export type GreenfieldExtensionPointContract = {
  id: string
  title: string
  contributionKinds: GreenfieldExtensionContributionKind[]
  requiredCapability: string | null
  platforms: Array<'ios' | 'android' | 'web' | 'desktop' | 'server'>
  maxContributions: number
}

export type GreenfieldExtensionContributionContract = {
  id: string
  title: string
  kind: GreenfieldExtensionContributionKind
  extensionPoint: string
  contractId: string
  requiredCapability: string | null
  platforms: Array<'ios' | 'android' | 'web' | 'desktop' | 'server'>
  requiresOnline: boolean
  priority: number
}

export type GreenfieldExtensionTrust =
  | 'firstParty'
  | 'verifiedPublisher'
  | 'reviewedCommunity'
  | 'untrustedManifest'

export type GreenfieldExtensionExecutionMode =
  | 'builtIn'
  | 'backgroundJob'
  | 'remoteHttp'
  | 'declarative'

export type GreenfieldExtensionEntrypoint = {
  id: string
  /** Entrypoint role, e.g. `route`, `hook`, `toolSurface`, `widgetSlot`. */
  role: string
  target: string
  surface?: string
}

export type GreenfieldExtensionManifest = {
  manifestVersion: 1

  extensionId: string
  kind: GreenfieldExtensionKind

  name: string
  description?: string
  version: string
  publisher: string

  capabilities: string[]
  compatibility: {
    minimumGreenfieldVersion: string
    maximumGreenfieldVersion?: string
  }

  entrypoints: GreenfieldExtensionEntrypoint[]
}
