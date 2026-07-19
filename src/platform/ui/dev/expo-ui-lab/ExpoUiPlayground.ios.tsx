import {Form, Host} from '@expo/ui/swift-ui'
import {StyleSheet, View} from 'react-native'

import {ExpoUiLabProvider} from '@/platform/ui/dev/expo-ui-lab/LabContext'
import {
  ButtonsSection,
  ContextMenuSection,
  DashboardSection,
  DateTimeSection,
  ProfileSection,
  SettingsSection,
  TaskManagementSection,
} from '@/platform/ui/dev/expo-ui-lab/sections'

/**
 * Full liquid-glass-style playground from betomoedano/expo-ui-playground,
 * adapted to SDK 57 `@expo/ui/swift-ui` APIs.
 */
export function ExpoUiPlayground() {
  return (
    <ExpoUiLabProvider>
      <View style={styles.fill}>
        <Host style={styles.fill}>
          <Form>
            <ProfileSection />
            <ButtonsSection />
            <DashboardSection />
            <TaskManagementSection />
            <ContextMenuSection />
            <DateTimeSection />
            <SettingsSection />
          </Form>
        </Host>
      </View>
    </ExpoUiLabProvider>
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    minHeight: 640,
  },
})
