import type {
  GreenfieldExtensionKind,
  GreenfieldExtensionManifest,
  GreenfieldExtensionTrust,
} from './extension.js'
import type {GreenfieldExtensionStatus} from './extension-installation.js'

export type GreenfieldExtensionCatalogueItem = {
  extensionId: string
  kind: GreenfieldExtensionKind
  name: string
  description: string
  version: string
  publisher: string
  trust: GreenfieldExtensionTrust
  permissions: string[]
  compatibility: {
    minimumGreenfieldVersion: string
    maximumGreenfieldVersion?: string
  }
  manifest: GreenfieldExtensionManifest
  status: GreenfieldExtensionStatus
  updateAvailable: boolean
  executable: boolean
}

/**
 * Phase 6S seed catalogue identifiers (first-party / contract stubs).
 */
export const GREENFIELD_CORE_CATALOGUE_EXTENSION_IDS = [
  'modula.core.composerTools',
  'modula.core.mediaFunctions',
  'modula.core.moderationPlugin',
  'modula.core.notificationPlugin',
  'modula.core.appearanceSyncPlugin',
  'modula.bridge.atprotocol',
  'modula.module.vaultNotes',
  'modula.module.tasks',
  'modula.module.dimon',
] as const

export type GreenfieldCoreCatalogueExtensionId =
  (typeof GREENFIELD_CORE_CATALOGUE_EXTENSION_IDS)[number]
