/**
 * Developer-only Expo UI playground (adapted from betomoedano/expo-ui-playground).
 *
 * Product screens must NOT import from here for shipping UI — evaluate candidates
 * here, then absorb winners into `src/platform/ui/*` wrappers.
 */
export {EXPO_UI_LAB_SECTIONS, getExpoUiLabSection} from '@/platform/ui/dev/expo-ui-lab/catalog'
export {ExpoUiPlayground} from '@/platform/ui/dev/expo-ui-lab/ExpoUiPlayground'
export {ExpoUiSectionDemo} from '@/platform/ui/dev/expo-ui-lab/ExpoUiSectionDemo'
export type {
  ExpoUiLabSectionId,
  ExpoUiLabSectionMeta,
} from '@/platform/ui/dev/expo-ui-lab/types'
