import {Linking, Platform} from 'react-native'

import {
  SettingsInfoRow,
  SettingsLinkRow,
  SettingsScreen,
  SettingsSection,
} from '@/features/settings/components/SettingsRows'
import {
  SYSTEM_ACCESSIBILITY_FEATURES,
  type SystemAccessibilityFeatureId,
} from '@/features/settings/data/systemAccessibilityFeatures'
import {useAppearance} from '@/theme/runtime/useAppearance'

export function SystemAccessibilityFeatureScreen({
  featureId,
}: {
  featureId: SystemAccessibilityFeatureId
}) {
  const feature = SYSTEM_ACCESSIBILITY_FEATURES[featureId]
  const {systemAccessibility} = useAppearance()
  const canOpenDeviceSettings = Platform.OS === 'ios' || Platform.OS === 'android'
  const statusValue =
    feature.status === 'screenReader'
      ? systemAccessibility.screenReaderEnabled
        ? 'On'
        : 'Off'
      : undefined
  const openLabel =
    Platform.OS === 'ios' ? 'Open iPhone Settings' : 'Open system Settings'

  return (
    <SettingsScreen title={feature.title}>
      <SettingsSection footer={`${feature.body} ${feature.footer}`}>
        <SettingsInfoRow
          label={feature.title}
          value={statusValue}
          last={!canOpenDeviceSettings}
        />
        {canOpenDeviceSettings ? (
          <SettingsLinkRow
            row={{
              title: openLabel,
              onPress: () => {
                void Linking.openSettings()
              },
            }}
            last
          />
        ) : null}
      </SettingsSection>
    </SettingsScreen>
  )
}
