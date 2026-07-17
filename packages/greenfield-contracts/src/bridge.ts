import type {GreenfieldExtensionManifest} from './extension.js'

/**
 * Bridges are optional, revocable external protocol integrations.
 * They never own Greenfield accounts, sessions, or private records.
 */
export type GreenfieldBridgeManifest = GreenfieldExtensionManifest & {
  kind: 'bridge'
  protocol: string
  publicationSupported: boolean
  ingestionSupported: boolean
  revocable: true
}
