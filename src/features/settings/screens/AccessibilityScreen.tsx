import Slider from '@react-native-community/slider'
import type {ReactNode} from 'react'
import {useState} from 'react'
import {ScrollView, StyleSheet, Switch, View} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {TEXT_SCALES, type TextScale} from '@/theme/contracts'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AccessibilityScreen() {
  const {preferences, resolved, systemAccessibility} = useAppearance()
  const actions = useAppearanceActions()
  const {colours, spacing} = useThemeTokens()
  const [textScalePreview, setTextScalePreview] = useState<TextScale>(
    preferences.textScale,
  )

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Accessibility" />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Accessibility</AppText>
            <AppText variant="body" colour="textSub">
              Keep Modula legible, operable, and calm across device settings.
            </AppText>
          </View>

          <Section title="Vision" icon="text">
            <MaterialSurface role="card" style={[styles.panel, {gap: spacing[3]}]}>
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
            </MaterialSurface>
            <OptionList>
              <ToggleRow
                label="Bold Text"
                value={resolved.accessibility.boldText}
                storedValue={preferences.boldText}
                onValueChange={actions.setBoldText}
                controlledByDevice={systemAccessibility.boldText}
              />
              <ToggleRow
                label="Increase Contrast"
                value={resolved.accessibility.increaseContrast}
                storedValue={preferences.increaseContrast}
                onValueChange={actions.setIncreaseContrast}
                controlledByDevice={systemAccessibility.increaseContrast}
              />
              <ToggleRow
                label="Reduce Transparency"
                value={resolved.accessibility.reduceTransparency}
                storedValue={preferences.reduceTransparency}
                onValueChange={actions.setReduceTransparency}
                controlledByDevice={systemAccessibility.reduceTransparency}
              />
              <ToggleRow
                label="Show Switch Labels"
                value={preferences.showSwitchLabels}
                storedValue={preferences.showSwitchLabels}
                onValueChange={actions.setShowSwitchLabels}
              />
            </OptionList>
          </Section>

          <Section title="Motion" icon="motion">
            <OptionList>
              <ToggleRow
                label="Reduce Motion"
                value={resolved.accessibility.reduceMotion}
                storedValue={preferences.reduceMotion}
                onValueChange={actions.setReduceMotion}
                controlledByDevice={systemAccessibility.reduceMotion}
              />
            </OptionList>
          </Section>

          <Section title="Interaction" icon="switch">
            <MaterialSurface role="card" style={[styles.panel, {gap: spacing[3]}]}>
              <StatusRow label="Larger Action Targets" value="Enabled" />
              <StatusRow label="Haptic Feedback" value="Device controlled" />
              <StatusRow
                label="Screen Reader"
                value={systemAccessibility.screenReaderEnabled ? 'Enabled' : 'Disabled'}
              />
            </MaterialSurface>
          </Section>

          <Section title="Device status" icon="accessibility">
            <MaterialSurface role="card" style={[styles.panel, {gap: spacing[2]}]}>
              <StatusRow
                label="Screen reader"
                value={systemAccessibility.screenReaderEnabled ? 'Enabled' : 'Disabled'}
              />
              <StatusRow
                label="Reduce motion"
                value={deviceValue(systemAccessibility.reduceMotion)}
              />
              <StatusRow
                label="Reduce transparency"
                value={deviceValue(systemAccessibility.reduceTransparency)}
              />
              <StatusRow
                label="Bold text"
                value={deviceValue(systemAccessibility.boldText)}
              />
            </MaterialSurface>
          </Section>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: AppIconName
  children: ReactNode
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}}>
      <View style={[styles.sectionTitle, {gap: spacing[2]}]}>
        <AppIcon name={icon} colour={colours.accent} size={20} />
        <AppText variant="title2">{title}</AppText>
      </View>
      {children}
    </View>
  )
}

function OptionList({children}: {children: ReactNode}) {
  return (
    <MaterialSurface role="card" style={styles.optionList}>
      {children}
    </MaterialSurface>
  )
}

function ToggleRow({
  label,
  value,
  storedValue,
  onValueChange,
  controlledByDevice = false,
}: {
  label: string
  value: boolean
  storedValue: boolean
  onValueChange: (value: boolean) => void
  controlledByDevice?: boolean
}) {
  const {preferences} = useAppearance()
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.toggleRow, {gap: spacing[3], borderBottomColor: colours.separator}]}>
      <View style={{flex: 1, gap: spacing[1]}}>
        <AppText variant="label">{label}</AppText>
        {controlledByDevice && !storedValue ? (
          <AppText variant="micro" colour="textMuted">
            Controlled by device
          </AppText>
        ) : null}
      </View>
      {preferences.showSwitchLabels ? (
        <AppText variant="micro" colour={value ? 'accent' : 'textMuted'}>
          {value ? 'ON' : 'OFF'}
        </AppText>
      ) : null}
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{false: colours.surface3, true: colours.accentSubtle}}
        thumbColor={value ? colours.accent : colours.textMuted}
      />
    </View>
  )
}

function StatusRow({label, value}: {label: string; value: string}) {
  const {colours} = useThemeTokens()
  return (
    <View style={[styles.statusRow, {borderBottomColor: colours.separator}]}>
      <AppText variant="body">{label}</AppText>
      <AppText variant="label" colour="textSub">
        {value}
      </AppText>
    </View>
  )
}

function deviceValue(enabled: boolean): string {
  return enabled ? 'Controlled by device' : 'Disabled'
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  optionList: {
    overflow: 'hidden',
  },
  panel: {
    padding: 16,
  },
  screen: {
    flex: 1,
  },
  sectionTitle: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  sliderLabels: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 50,
  },
  toggleRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
})
