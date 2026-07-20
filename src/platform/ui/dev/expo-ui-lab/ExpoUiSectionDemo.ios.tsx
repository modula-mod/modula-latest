import {Form, Host} from '@expo/ui/swift-ui'
import {StyleSheet, View} from 'react-native'

import {ExpoUiLabProvider} from '@/platform/ui/dev/expo-ui-lab/LabContext'
import {EXPO_UI_LAB_SECTION_COMPONENTS} from '@/platform/ui/dev/expo-ui-lab/sections'
import type {ExpoUiLabSectionId} from '@/platform/ui/dev/expo-ui-lab/types'

export function ExpoUiSectionDemo({sectionId}: {sectionId: ExpoUiLabSectionId}) {
  const Section = EXPO_UI_LAB_SECTION_COMPONENTS[sectionId]

  return (
    <ExpoUiLabProvider>
      <View style={styles.fill}>
        <Host style={styles.fill}>
          <Form>
            <Section />
          </Form>
        </Host>
      </View>
    </ExpoUiLabProvider>
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    minHeight: 420,
  },
})
