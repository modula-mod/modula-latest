import type {GreenfieldExtensionManifest} from './extension.js'

export type GreenfieldWidgetSlot =
  | 'profileCard'
  | 'boardBlock'
  | 'feedAttachment'
  | 'moduleStatus'
  | 'analyticsSummary'

export type GreenfieldWidgetManifest = GreenfieldExtensionManifest & {
  kind: 'widget'
  slots: GreenfieldWidgetSlot[]
}
