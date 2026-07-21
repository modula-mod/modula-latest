import type {ComponentType} from 'react'

import {ButtonsSection} from '@/platform/ui/dev/expo-ui-lab/sections/ButtonsSection'
import {ContextMenuSection} from '@/platform/ui/dev/expo-ui-lab/sections/ContextMenuSection'
import {DashboardSection} from '@/platform/ui/dev/expo-ui-lab/sections/DashboardSection'
import {DateTimeSection} from '@/platform/ui/dev/expo-ui-lab/sections/DateTimeSection'
import {ProfileSection} from '@/platform/ui/dev/expo-ui-lab/sections/ProfileSection'
import {SettingsSection} from '@/platform/ui/dev/expo-ui-lab/sections/SettingsSection'
import {TaskManagementSection} from '@/platform/ui/dev/expo-ui-lab/sections/TaskManagementSection'
import type {ExpoUiLabSectionId} from '@/platform/ui/dev/expo-ui-lab/types'

export const EXPO_UI_LAB_SECTION_COMPONENTS: Record<
  ExpoUiLabSectionId,
  ComponentType
> = {
  buttons: ButtonsSection,
  profile: ProfileSection,
  dashboard: DashboardSection,
  tasks: TaskManagementSection,
  'context-menu': ContextMenuSection,
  'date-time': DateTimeSection,
  settings: SettingsSection,
}

export {
  ButtonsSection,
  ContextMenuSection,
  DashboardSection,
  DateTimeSection,
  ProfileSection,
  SettingsSection,
  TaskManagementSection,
}
