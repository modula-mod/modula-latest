import Slider from '@react-native-community/slider'
import type {ReactNode} from 'react'
import {useMemo, useState} from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {validateCustomAccent} from '@/theme/accents'
import {ACCENT_PRESETS} from '@/theme/accents/resolveAccent'
import {
  APPEARANCE_MODES,
  SURFACE_TYPES,
  TEXT_SCALES,
  THEME_FAMILIES,
  type AppearanceMode,
  type SurfaceType,
  type ThemeFamily,
} from '@/theme/contracts'
import {resolveColourPalette} from '@/theme/palettes'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const modeLabels: Record<AppearanceMode, string> = {
  system: 'System',
  light: 'Light',
  dim: 'Dim',
  dark: 'Dark',
  oled: 'OLED',
}

const familyLabels: Record<ThemeFamily, string> = {
  standard: 'Standard',
  forest: 'Forest',
  ocean: 'Ocean',
  plum: 'Plum',
  espresso: 'Espresso',
  spaceGray: 'Space Gray',
}

const surfaceCopy: Record<SurfaceType, string> = {
  native: 'Platform material when available, with safe fallbacks.',
  solid: 'Opaque, stable hierarchy for every accessibility mode.',
  glass: 'Selective blur for navigation and floating controls.',
  glay: 'Soft material colour with modest physical depth.',
  minimalSpatial: 'Quiet surfaces with subtle separation.',
  skeuomorphic: 'Tactile controls with restrained highlights.',
  neomorphic: 'Raised controls where contrast remains safe.',
}

export function AppearanceScreen() {
  const {preferences, resolved, systemAccessibility} = useAppearance()
  const actions = useAppearanceActions()
  const {colours, spacing} = useThemeTokens()
  const [customModalVisible, setCustomModalVisible] = useState(false)
  const [customInput, setCustomInput] = useState(
    preferences.customAccent ?? resolved.accent.base,
  )
  const [textScalePreview, setTextScalePreview] = useState(preferences.textScale)
  const customValidation = useMemo(
    () => validateCustomAccent(customInput),
    [customInput],
  )

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Appearance" />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Appearance</AppText>
            <AppText variant="body" colour="textSub">
              Shape Modula around colour, material, text, and accessibility-safe
              fallbacks.
            </AppText>
          </View>

          <Section title="Live preview">
            <LivePreview />
          </Section>

          <Section title="Colour mode">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.tileRow, {gap: spacing[3]}]}>
              {APPEARANCE_MODES.map(mode => (
                <ModeTile
                  key={mode}
                  mode={mode}
                  selected={preferences.mode === mode}
                  onPress={() => actions.setMode(mode)}
                />
              ))}
            </ScrollView>
          </Section>

          <Section title="Theme family">
            {preferences.mode === 'light' ? (
              <InlineNote text="Theme families apply to Dim, Dark and OLED. Your selection will remain saved." />
            ) : null}
            <View style={[styles.wrapRow, {gap: spacing[2]}]}>
              {THEME_FAMILIES.map(family => (
                <ChoicePill
                  key={family}
                  label={familyLabels[family]}
                  selected={preferences.family === family}
                  onPress={() => actions.setThemeFamily(family)}
                />
              ))}
            </View>
          </Section>

          <Section title="Accent">
            <View style={[styles.swatchGrid, {gap: spacing[3]}]}>
              {ACCENT_PRESETS.map(accent => (
                <AccentSwatch
                  key={accent.id}
                  label={accent.label}
                  value={accent.base}
                  selected={preferences.accentId === accent.id}
                  onPress={() => actions.setAccent(accent.id)}
                />
              ))}
              <AccentSwatch
                label="Custom"
                value={preferences.customAccent ?? resolved.accent.base}
                selected={preferences.accentId === 'custom'}
                onPress={() => setCustomModalVisible(true)}
              />
            </View>
          </Section>

          <Section title="Surface Type">
            <View style={{gap: spacing[3]}}>
              {SURFACE_TYPES.map(surfaceType => (
                <SurfaceTypeCard
                  key={surfaceType}
                  surfaceType={surfaceType}
                  selected={preferences.surfaceType === surfaceType}
                  onPress={() => actions.setSurfaceType(surfaceType)}
                />
              ))}
            </View>
          </Section>

          <Section title="Text size">
            <MaterialSurface role="card" style={[styles.sliderPanel, {gap: spacing[3]}]}>
              <View style={styles.sliderLabels}>
                <AppText variant="caption">A</AppText>
                <AppText
                  variant="body"
                  style={{
                    fontSize: 16 * textScalePreview,
                    lineHeight: 22 * textScalePreview,
                  }}>
                  Sample text
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
                onValueChange={value => {
                  setTextScalePreview(TEXT_SCALES[Math.round(value)] ?? 1)
                }}
                onSlidingComplete={value => {
                  const scale = TEXT_SCALES[Math.round(value)] ?? 1
                  setTextScalePreview(scale)
                  actions.setTextScale(scale)
                }}
              />
              <View style={styles.scaleLabels}>
                {TEXT_SCALES.map(scale => (
                  <AppText key={scale} variant="micro" colour="textMuted">
                    {Math.round(scale * 100)}%
                  </AppText>
                ))}
              </View>
            </MaterialSurface>
          </Section>

          <Section title="Interface options">
            <MaterialSurface role="card" style={styles.optionList}>
              <SwitchRow
                title="Bold Text"
                value={resolved.accessibility.boldText}
                storedValue={preferences.boldText}
                onValueChange={actions.setBoldText}
                deviceOverride={systemAccessibility.boldText}
              />
              <SwitchRow
                title="Reduce Motion"
                value={resolved.accessibility.reduceMotion}
                storedValue={preferences.reduceMotion}
                onValueChange={actions.setReduceMotion}
                deviceOverride={systemAccessibility.reduceMotion}
              />
              <SwitchRow
                title="Reduce Transparency"
                value={resolved.accessibility.reduceTransparency}
                storedValue={preferences.reduceTransparency}
                onValueChange={actions.setReduceTransparency}
                deviceOverride={systemAccessibility.reduceTransparency}
              />
              <SwitchRow
                title="Increase Contrast"
                value={resolved.accessibility.increaseContrast}
                storedValue={preferences.increaseContrast}
                onValueChange={actions.setIncreaseContrast}
                deviceOverride={systemAccessibility.increaseContrast}
              />
              <SwitchRow
                title="Show ON/OFF Labels"
                value={preferences.showSwitchLabels}
                storedValue={preferences.showSwitchLabels}
                onValueChange={actions.setShowSwitchLabels}
              />
            </MaterialSurface>
          </Section>

          <AppPressable
            accessibilityLabel="Reset appearance"
            onPress={actions.resetAppearance}
            style={[
              styles.resetButton,
              {borderColor: colours.destructive, backgroundColor: colours.destructiveSubtle},
            ]}>
            <AppIcon name="reset" colour={colours.destructive} />
            <AppText variant="label" style={{color: colours.destructive}}>
              Reset Appearance
            </AppText>
          </AppPressable>
        </ScrollView>
      </ResponsiveContent>

      <Modal
        transparent
        visible={customModalVisible}
        animationType="fade"
        onRequestClose={() => setCustomModalVisible(false)}>
        <View style={[styles.modalBackdrop, {backgroundColor: colours.backdrop}]}>
          <MaterialSurface role="modal" style={[styles.modal, {gap: spacing[4]}]}>
            <View style={{gap: spacing[1]}}>
              <AppText variant="title2">Custom accent</AppText>
              <AppText variant="body" colour="textSub">
                Use #RGB or #RRGGBB. Modula chooses readable text automatically.
              </AppText>
            </View>
            <View style={[styles.customPreview, {gap: spacing[3]}]}>
              <View
                style={[
                  styles.customSwatch,
                  {
                    backgroundColor: customValidation.valid
                      ? customValidation.value
                      : colours.surface3,
                    borderColor: colours.borderStrong,
                  },
                ]}
              />
              <TextInput
                value={customInput}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="Custom accent hex colour"
                placeholder={resolved.accent.base}
                placeholderTextColor={colours.textMuted}
                onChangeText={setCustomInput}
                style={[
                  styles.input,
                  {
                    color: colours.textMain,
                    borderColor: customValidation.valid
                      ? colours.border
                      : colours.destructive,
                    backgroundColor: colours.surface1,
                  },
                ]}
              />
            </View>
            {customValidation.message ? (
              <AppText variant="caption" style={{color: colours.destructive}}>
                {customValidation.message}
              </AppText>
            ) : null}
            <View style={[styles.modalActions, {gap: spacing[2]}]}>
              <AppPressable
                accessibilityLabel="Cancel custom accent"
                onPress={() => setCustomModalVisible(false)}
                style={[styles.modalButton, {borderColor: colours.border}]}>
                <AppText variant="label">Cancel</AppText>
              </AppPressable>
              <AppPressable
                accessibilityLabel="Apply custom accent"
                disabled={!customValidation.valid}
                onPress={() => {
                  if (customValidation.valid) {
                    actions.setCustomAccent(customValidation.value)
                    setCustomModalVisible(false)
                  }
                }}
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: colours.accent,
                    borderColor: colours.accent,
                  },
                ]}>
                <AppText variant="label" colour="accentForeground">
                  Apply
                </AppText>
              </AppPressable>
            </View>
          </MaterialSurface>
        </View>
      </Modal>
    </View>
  )
}

function Section({title, children}: {title: string; children: ReactNode}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}}>
      <AppText variant="title2">{title}</AppText>
      {children}
    </View>
  )
}

function LivePreview() {
  const {colours, spacing} = useThemeTokens()
  return (
    <MaterialSurface role="card" style={[styles.preview, {gap: spacing[3]}]}>
      <View style={styles.previewHeader}>
        <AppText variant="headline">Modula</AppText>
        <View style={[styles.previewDot, {backgroundColor: colours.accent}]} />
      </View>
      <View style={[styles.previewPost, {gap: spacing[3]}]}>
        <Avatar name="Ari Modula" size={38} colour={colours.accent} />
        <View style={{flex: 1, gap: spacing[1]}}>
          <AppText variant="label">Ari Modula</AppText>
          <AppText variant="body" colour="textSub">
            The profile is the centre of the workspace.
          </AppText>
          <View
            style={[
              styles.previewMedia,
              {backgroundColor: colours.mediaGlowFallback, borderColor: colours.accentBorder},
            ]}
          />
        </View>
      </View>
      <View style={styles.previewNav}>
        {['home', 'discover', 'create', 'activity', 'profile'].map((name, index) => (
          <View
            key={name}
            style={[
              styles.previewNavItem,
              {backgroundColor: index === 0 ? colours.accentSubtle : colours.surface2},
            ]}
          />
        ))}
      </View>
    </MaterialSurface>
  )
}

function ModeTile({
  mode,
  selected,
  onPress,
}: {
  mode: AppearanceMode
  selected: boolean
  onPress: () => void
}) {
  const {colours, spacing} = useThemeTokens()
  const previewMode = mode === 'system' ? 'light' : mode
  const palette = resolveColourPalette('standard', previewMode)

  return (
    <AppPressable
      accessibilityLabel={`${modeLabels[mode]} mode`}
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        styles.modeTile,
        {
          backgroundColor: palette.canvas,
          borderColor: selected ? colours.accent : colours.border,
          gap: spacing[2],
        },
      ]}>
      <View style={[styles.modeSurface, {backgroundColor: palette.surface1}]} />
      <View style={[styles.modeSurfaceSmall, {backgroundColor: palette.surface2}]} />
      <AppText
        variant="label"
        style={{color: selected ? colours.accent : palette.textMain}}>
        {modeLabels[mode]}
      </AppText>
    </AppPressable>
  )
}

function ChoicePill({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const {colours} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        styles.choicePill,
        {
          backgroundColor: selected ? colours.accentSubtle : colours.surface1,
          borderColor: selected ? colours.accent : colours.border,
        },
      ]}>
      <AppText variant="label" style={{color: selected ? colours.accent : colours.textMain}}>
        {label}
      </AppText>
    </AppPressable>
  )
}

function AccentSwatch({
  label,
  value,
  selected,
  onPress,
}: {
  label: string
  value: string
  selected: boolean
  onPress: () => void
}) {
  const {colours} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={`${label} accent`}
      accessibilityState={{selected}}
      onPress={onPress}
      style={styles.swatchItem}>
      <View
        style={[
          styles.swatch,
          {
            backgroundColor: value,
            borderColor: selected ? colours.textMain : colours.borderStrong,
          },
        ]}>
        {selected ? <AppIcon name="check" colour={colours.accentForeground} size={18} /> : null}
      </View>
      <AppText variant="caption" numberOfLines={2} style={styles.swatchLabel}>
        {label}
      </AppText>
    </AppPressable>
  )
}

function SurfaceTypeCard({
  surfaceType,
  selected,
  onPress,
}: {
  surfaceType: SurfaceType
  selected: boolean
  onPress: () => void
}) {
  const {colours, spacing} = useThemeTokens()
  const title = labelSurface(surfaceType)

  return (
    <AppPressable
      accessibilityLabel={`${title} Surface Type`}
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        styles.surfaceCard,
        {
          borderColor: selected ? colours.accent : colours.border,
          backgroundColor: selected ? colours.accentSubtle : colours.surface1,
          gap: spacing[3],
        },
      ]}>
      <View style={styles.surfacePreview}>
        <MaterialSurface role="floating" style={styles.surfacePreviewChip}>
          <View style={[styles.previewLine, {backgroundColor: colours.accent}]} />
        </MaterialSurface>
      </View>
      <View style={{flex: 1, gap: spacing[1]}}>
        <AppText variant="headline">{title}</AppText>
        <AppText variant="caption" colour="textSub">
          {surfaceCopy[surfaceType]}
        </AppText>
        {surfaceType === 'native' ? (
          <AppText variant="micro" colour="textMuted">
            Native glass is iOS-only and falls back safely elsewhere.
          </AppText>
        ) : null}
      </View>
      {selected ? <AppIcon name="check" colour={colours.accent} /> : null}
    </AppPressable>
  )
}

function SwitchRow({
  title,
  value,
  storedValue,
  onValueChange,
  deviceOverride = false,
}: {
  title: string
  value: boolean
  storedValue: boolean
  onValueChange: (value: boolean) => void
  deviceOverride?: boolean
}) {
  const {preferences} = useAppearance()
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.switchRow, {gap: spacing[3], borderBottomColor: colours.separator}]}>
      <View style={{flex: 1, gap: spacing[1]}}>
        <AppText variant="label">{title}</AppText>
        {deviceOverride && !storedValue ? (
          <AppText variant="micro" colour="textMuted">
            Enabled by your device. Modula will keep it active.
          </AppText>
        ) : null}
      </View>
      {preferences.showSwitchLabels ? (
        <AppText variant="micro" colour={value ? 'accent' : 'textMuted'}>
          {value ? 'ON' : 'OFF'}
        </AppText>
      ) : null}
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        trackColor={{false: colours.surface3, true: colours.accentSubtle}}
        thumbColor={value ? colours.accent : colours.textMuted}
      />
    </View>
  )
}

function InlineNote({text}: {text: string}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <MaterialSurface role="content" style={[styles.note, {borderColor: colours.border, gap: spacing[2]}]}>
      <AppIcon name="info" colour={colours.accent} size={18} />
      <AppText variant="caption" colour="textSub" style={{flex: 1}}>
        {text}
      </AppText>
    </MaterialSurface>
  )
}

function labelSurface(surfaceType: SurfaceType): string {
  return surfaceType.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())
}

const styles = StyleSheet.create({
  choicePill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  customPreview: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  customSwatch: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    width: 52,
  },
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  modal: {
    margin: 18,
    maxWidth: 480,
    padding: 18,
    width: '92%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  modalButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
  },
  modeSurface: {
    borderRadius: 12,
    height: 44,
    width: '100%',
  },
  modeSurfaceSmall: {
    borderRadius: 999,
    height: 10,
    width: '64%',
  },
  modeTile: {
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 130,
    padding: 12,
    width: 118,
  },
  note: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    padding: 12,
  },
  optionList: {
    overflow: 'hidden',
  },
  preview: {
    padding: 16,
  },
  previewDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLine: {
    borderRadius: 999,
    height: 10,
    width: 42,
  },
  previewMedia: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    height: 84,
  },
  previewNav: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  previewNavItem: {
    borderRadius: 999,
    flex: 1,
    height: 8,
  },
  previewPost: {
    flexDirection: 'row',
  },
  resetButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  screen: {
    flex: 1,
  },
  sliderLabels: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderPanel: {
    padding: 16,
  },
  surfaceCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 92,
    padding: 14,
  },
  surfacePreview: {
    width: 62,
  },
  surfacePreviewChip: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 54,
  },
  swatch: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  swatchItem: {
    alignItems: 'center',
    gap: 6,
    width: 76,
  },
  swatchLabel: {
    textAlign: 'center',
  },
  switchRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tileRow: {
    paddingRight: 16,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
