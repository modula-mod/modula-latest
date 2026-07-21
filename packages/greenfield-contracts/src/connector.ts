import type {GreenfieldExtensionManifest} from './extension.js'

export type GreenfieldConnectorManifest = GreenfieldExtensionManifest & {
  kind: 'connector'
  externalSystem: string
  authModes: Array<'oauth' | 'apiKey' | 'none'>
  revocable: true
}
