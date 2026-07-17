export type GreenfieldExtensionKind =
  | 'module'
  | 'plugin'
  | 'function'
  | 'tool'
  | 'connector'
  | 'widget'
  | 'bridge'

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
