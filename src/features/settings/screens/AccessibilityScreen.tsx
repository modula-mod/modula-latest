import Slider from '@react-native-community/slider'
import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppText} from '@/components/primitives/AppText'
import {
  SettingsLinkRow,
  SettingsOverflowMenu,
  SettingsScreen,
  SettingsSection,
  SettingsToggleRow,
} from '@/features/settings/components/SettingsRows'
import {TEXT_SCALES, type TextScale} from '@/theme/contracts'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AccessibilityScreen() {
  const router = useRouter()
  const {preferences, resolved, systemAccessibility} = useAppearance()
  const actions = useAppearanceActions()
  const {colours, spacing, radius} = useThemeTokens()
  const [textScalePreview, setTextScalePreview] = useState<TextScale>(
    preferences.textScale,
  )
  const [hapticFeedback, setHapticFeedback] = useState(true)

  return (
    <SettingsScreen
      title="Accessibility"
      caption="Keep Modula legible, operable, and calm across device settings."
      right={
        <SettingsOverflowMenu
          title="Accessibility"
          actions={[
            {id: 'appearance', label: 'Open Appearance'},
            {id: 'reset-scale', label: 'Reset text size'},
          ]}
          onAction={id => {
            if (id === 'appearance') router.push('/settings/appearance' as Href)
            if (id === 'reset-scale') {
              setTextScalePreview(1)
              actions.setTextScale(1)
            }
          }}
        />
      }>
      <SettingsSection title="Text size">
        <View style={[styles.sliderPanel, {gap: spacing[3], padding: spacing[4]}]}>
          <View style={styles.sliderLabels}>
            <AppText variant="caption">A</AppText>
            <AppText
              variant="body"
              style={{
                fontSize: 16 * textScalePreview,
                lineHeight: 22 * textScalePreview,
              }}>
              Sample readable text
            </AppText>
            <AppText variant="title2">A</AppText>
          </View>
          <Slider
            minimumValue={0}
            maximumValue={TEXT_SCALES.length - 1}
            step={1}
            value={TEXT_SCALES.indexOf(preferences.textScale)}
            minimumTrackTintColor={colours.accent}
            maximumTrackTintColor={colours.borderStrong}
            thumbTintColor={colours.accent}
            accessibilityLabel="Text size"
            onValueChange={value =>
              setTextScalePreview(TEXT_SCALES[Math.round(value)] ?? 1)
            }
            onSlidingComplete={value => {
              const scale = TEXT_SCALES[Math.round(value)] ?? 1
              setTextScalePreview(scale)
              actions.setTextScale(scale)
            }}
          />
        </View>
      </SettingsSection>

      <SettingsSection title="Vision">
        <SettingsToggleRow
          label="Bold text"
          description={
            systemAccessibility.boldText && !preferences.boldText
              ? 'Controlled by device'
              : undefined
          }
          value={resolved.accessibility.boldText}
          onValueChange={actions.setBoldText}
        />
        <SettingsToggleRow
          label="Increase contrast"
          description={
            systemAccessibility.increaseContrast && !preferences.increaseContrast
              ? 'Controlled by device'
              : undefined
          }
          value={resolved.accessibility.increaseContrast}
          onValueChange={actions.setIncreaseContrast}
        />
        <SettingsToggleRow
          label="Reduce transparency"
          description={
            systemAccessibility.reduceTransparency && !preferences.reduceTransparency
              ? 'Controlled by device'
              : 'Forces opaque chrome over Glass / Glay'
          }
          value={resolved.accessibility.reduceTransparency}
          onValueChange={actions.setReduceTransparency}
        />
        <SettingsToggleRow
          label="Button shapes"
          value={preferences.showSwitchLabels}
          onValueChange={actions.setShowSwitchLabels}
          last
        />
      </SettingsSection>

      <SettingsSection title="Motion">
        <SettingsToggleRow
          label="Reduce motion"
          description={
            systemAccessibility.reduceMotion && !preferences.reduceMotion
              ? 'Controlled by device'
              : undefined
          }
          value={resolved.accessibility.reduceMotion}
          onValueChange={actions.setReduceMotion}
        />
        <SettingsToggleRow
          label="Haptic feedback"
          description="Respect device haptics where available."
          value={hapticFeedback}
          onValueChange={setHapticFeedback}
          last
        />
      </SettingsSection>

      <SettingsSection title="Related">
        <SettingsLinkRow
          row={{
            title: 'Appearance',
            description: 'Colour mode, accent, and Surface Type.',
            icon: 'appearance',
            route: '/settings/appearance',
          }}
          last
        />
      </SettingsSection>

      <View
        style={[
          styles.statusCard,
          {
            borderColor: colours.border,
            backgroundColor: colours.surfaceRaised,
            borderRadius: radius.large,
            padding: spacing[4],
            gap: spacing[2],
          },
        ]}>
        <AppText variant="label">Device status</AppText>
        <AppText variant="caption" colour="textSecondary">
          Screen reader:{' '}
          {systemAccessibility.screenReaderEnabled ? 'Enabled' : 'Disabled'}
        </AppText>
        <AppText variant="caption" colour="textSecondary">
          Larger action targets: Enabled · Haptics: Device controlled
        </AppText>
      </View>
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  sliderLabels: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderPanel: {
    width: '100%',
  },
  statusCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
})
