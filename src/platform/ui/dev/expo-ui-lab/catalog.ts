import type {ExpoUiLabSectionMeta} from '@/platform/ui/dev/expo-ui-lab/types'

/**
 * Catalog of expo-ui-playground sections adapted for Modula Developer settings.
 * Use this to pick candidates by product context — product screens still go through
 * `src/platform/ui/*` wrappers, never `@expo/ui/swift-ui` directly.
 */
export const EXPO_UI_LAB_SECTIONS: ExpoUiLabSectionMeta[] = [
  {
    id: 'buttons',
    title: 'Buttons',
    summary: 'Glass, bordered, plain, and destructive button variants with SF Symbols.',
    expoComponents: ['Button', 'Host', 'buttonStyle', 'controlSize', 'tint'],
    modulaWrappers: ['ModulaButton', 'ModulaIconButton'],
    suggestedContexts: ['Composer publish', 'Settings CTAs', 'Destructive sign-out / delete'],
    status: 'wrapped',
  },
  {
    id: 'profile',
    title: 'Profile & chrome',
    summary: 'Avatar row, ColorPicker, LabeledContent, DisclosureGroup, glass Group.',
    expoComponents: [
      'ColorPicker',
      'DisclosureGroup',
      'Image',
      'LabeledContent',
      'Picker',
      'Toggle',
      'Group',
    ],
    modulaWrappers: ['ModulaDisclosureGroup', 'Avatar'],
    suggestedContexts: ['Appearance accents', 'Profile settings', 'Account header density'],
    status: 'candidate',
  },
  {
    id: 'dashboard',
    title: 'Gauges & sliders',
    summary: 'Circular/linear gauges plus interactive sliders for live metrics.',
    expoComponents: ['Gauge', 'Slider', 'gaugeStyle', 'Button'],
    modulaWrappers: [],
    suggestedContexts: ['Board health', 'Module runtime metrics', 'Developer diagnostics'],
    status: 'explore',
  },
  {
    id: 'tasks',
    title: 'Lists & empty states',
    summary: 'Segmented filter, toggle rows, and ContentUnavailableView empty state.',
    expoComponents: ['Picker', 'Toggle', 'ContentUnavailableView', 'VStack', 'HStack'],
    modulaWrappers: ['SystemSwitch', 'QueryErrorState'],
    suggestedContexts: ['Feed filters', 'Saved / drafts empty', 'Moderation lists'],
    status: 'candidate',
  },
  {
    id: 'context-menu',
    title: 'Context menus',
    summary: 'Long-press menus with nested menus, toggles, and destructive actions.',
    expoComponents: ['ContextMenu', 'Menu', 'Button', 'Toggle'],
    modulaWrappers: ['ModulaContextMenu', 'ModulaMenu', 'presentModulaActions'],
    suggestedContexts: ['Feed post overflow', 'Messages rows', 'Activity items'],
    status: 'wrapped',
  },
  {
    id: 'date-time',
    title: 'Date & time',
    summary: 'Native DatePicker with date / time / date+time component modes.',
    expoComponents: ['DatePicker', 'Picker'],
    modulaWrappers: [],
    suggestedContexts: ['Mute until', 'Scheduled posts', 'Reminder / quiet hours'],
    status: 'explore',
  },
  {
    id: 'settings',
    title: 'Settings form',
    summary: 'Form toggles, disclosure groups, and pickers in a native Section.',
    expoComponents: ['Toggle', 'DisclosureGroup', 'Picker', 'Section', 'Form'],
    modulaWrappers: ['SystemSwitch', 'ModulaDisclosureGroup', 'SystemSection', 'SystemListRow'],
    suggestedContexts: ['Settings tree', 'Appearance subsections', 'Notification prefs'],
    status: 'wrapped',
  },
]

export function getExpoUiLabSection(id: string): ExpoUiLabSectionMeta | undefined {
  return EXPO_UI_LAB_SECTIONS.find(section => section.id === id)
}
