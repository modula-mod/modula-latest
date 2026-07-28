import Slider from '@react-native-community/slider'
import {LinearGradient} from 'expo-linear-gradient'
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

import {ProgressiveBlurEdges} from '@/components/materials/ProgressiveBlurEdges'
import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {AdvancedCameraMaskedBlurPreview} from '@/features/settings/components/AdvancedCameraMaskedBlurPreview'
import {ModulaJoinIsland} from '@/platform/ui/motion'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {validateCustomAccent} from '@/theme/accents'
import {ACCENT_PRESETS} from '@/theme/accents/resolveAccent'
import {
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

/** Primary mode tiles — iOS-like grid; OLED stays in the overflow row. */
const PRIMARY_MODES: AppearanceMode[] = ['system', 'dark', 'light', 'dim']

const modeLabels: Record<AppearanceMode, string> = {
  system: 'System',
  light: 'Light',
  dim: 'Dim',
  dark: 'Dark',
  oled: 'OLED',
}

const modeIcons: Record<AppearanceMode, 'contrast' | 'appearance' | 'photo' | 'modules'> = {
  system: 'appearance',
  light: 'photo',
  dim: 'modules',
  dark: 'contrast',
  oled: 'contrast',
}

const familyLabels: Record<ThemeFamily, string> = {
  standard: 'Default',
  forest: 'Forest',
  ocean: 'Ocean',
  plum: 'Plum',
  espresso: 'Espresso',
  spaceGray: 'Space Gray',
}

const surfaceLabels: Record<SurfaceType, string> = {
  native: 'Native',
  solid: 'Solid',
  glass: 'Glass',
  glay: 'Glay',
  minimalSpatial: 'Minimal Spatial',
  skeuomorphic: 'Skeuomorphic',
  neomorphic: 'Neomorphic',
}

/** Surfaces shown as chrome bubbles on the wallpaper preview. */
const PREVIEW_SURFACES: SurfaceType[] = ['glass', 'glay', 'solid']

export function AppearanceScreen() {
  const {preferences, resolved, systemAccessibility} = useAppearance()
  const actions = useAppearanceActions()
  const {colours, spacing, radius} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const [customModalVisible, setCustomModalVisible] = useState(false)
  const [familiesOpen, setFamiliesOpen] = useState(false)
  const [surfacesOpen, setSurfacesOpen] = useState(false)
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
          contentContainerStyle={[styles.content, {gap: spacing[5], paddingBottom: tabPadding}]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <AppText variant="caption" colour="textTertiary">
            Colour, chrome, and accessibility-safe fallbacks — not Apple Settings.
          </AppText>

          <ChromePreview
            surfaceType={preferences.surfaceType}
            onSelectSurface={actions.setSurfaceType}
          />

          <Section title="Accent">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.swatchRow, {gap: spacing[3]}]}>
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
            </ScrollView>
          </Section>

          <Section title="Mode">
            <View style={[styles.modeGrid, {gap: spacing[3]}]}>
              {PRIMARY_MODES.map(mode => (
                <ModeTile
                  key={mode}
                  mode={mode}
                  selected={preferences.mode === mode}
                  onPress={() => actions.setMode(mode)}
                />
              ))}
            </View>
            <AppPressable
              accessibilityLabel="OLED mode"
              accessibilityState={{selected: preferences.mode === 'oled'}}
              onPress={() => actions.setMode('oled')}
              style={[
                styles.oledRow,
                {
                  borderColor:
                    preferences.mode === 'oled' ? colours.accent : colours.border,
                  backgroundColor:
                    preferences.mode === 'oled' ? colours.accentSubtle : colours.surface,
                  borderRadius: radius.large,
                },
              ]}>
              <AppIcon
                name="contrast"
                colour={preferences.mode === 'oled' ? colours.accent : colours.textSecondary}
              />
              <View style={{flex: 1, gap: 2}}>
                <AppText variant="label">OLED</AppText>
                <AppText variant="caption" colour="textTertiary">
                  Pure black canvas when supported
                </AppText>
              </View>
              {preferences.mode === 'oled' ? (
                <AppIcon name="check" colour={colours.accent} size={18} />
              ) : null}
            </AppPressable>
          </Section>

          <MaterialSurface
            role="card"
            style={[styles.groupCard, {borderColor: colours.border, borderRadius: radius.large}]}>
            <LinkRow
              title="Theme family"
              value={familyLabels[preferences.family]}
              onPress={() => setFamiliesOpen(open => !open)}
            />
            {familiesOpen ? (
              <View style={[styles.expandBlock, {borderTopColor: colours.separator, gap: spacing[2]}]}>
                {preferences.mode === 'light' ? (
                  <AppText variant="caption" colour="textTertiary">
                    Families apply to Dim, Dark, and OLED. Selection stays saved.
                  </AppText>
                ) : (
                  <AppText variant="caption" colour="textTertiary">
                    Non-standard families are Preview palettes.
                  </AppText>
                )}
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
              </View>
            ) : null}

            <LinkRow
              title="Surface Type"
              value={surfaceLabels[preferences.surfaceType]}
              onPress={() => setSurfacesOpen(open => !open)}
              last={!surfacesOpen}
            />
            {surfacesOpen ? (
              <View style={[styles.expandBlock, {borderTopColor: colours.separator, gap: spacing[2]}]}>
                <AppText variant="caption" colour="textTertiary">
                  Chrome-layer contracts only — full glass engines remain deferred.
                </AppText>
                <View style={[styles.wrapRow, {gap: spacing[2]}]}>
                  {SURFACE_TYPES.map(surfaceType => (
                    <ChoicePill
                      key={surfaceType}
                      label={surfaceLabels[surfaceType]}
                      selected={preferences.surfaceType === surfaceType}
                      onPress={() => actions.setSurfaceType(surfaceType)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </MaterialSurface>

          <Section title="Text size">
            <MaterialSurface
              role="card"
              style={[
                styles.sliderPanel,
                {
                  gap: spacing[3],
                  borderRadius: radius.large,
                  borderColor: colours.border,
                },
              ]}>
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
            </MaterialSurface>
          </Section>

          <Section title="Interface">
            <MaterialSurface
              role="card"
              style={[
                styles.optionList,
                {borderRadius: radius.large, borderColor: colours.border},
              ]}>
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
                title="Show ON/OFF Labels"
                value={preferences.showSwitchLabels}
                storedValue={preferences.showSwitchLabels}
                onValueChange={actions.setShowSwitchLabels}
                last
              />
            </MaterialSurface>
            <AppText variant="caption" colour="textTertiary">
              Reduce Transparency forces opaque chrome and wins over Glass / Glay / Native
              previews.
            </AppText>
          </Section>

          <Section title="Advanced">
            <MaterialSurface
              role="card"
              style={[
                styles.optionList,
                {borderRadius: radius.large, borderColor: colours.border},
              ]}>
              <SwitchRow
                title="Camera masked blur"
                value={preferences.advancedChromeEffect === 'cameraMaskedBlur'}
                storedValue={preferences.advancedChromeEffect === 'cameraMaskedBlur'}
                onValueChange={enabled => {
                  actions.setAdvancedChromeEffect(
                    enabled ? 'cameraMaskedBlur' : 'off',
                  )
                }}
                last
              />
            </MaterialSurface>
            <AppText variant="caption" colour="textTertiary">
              Preview — live camera cut through chrome glyphs. Needs camera permission;
              nothing is recorded. Reduce Transparency disables the blur layer.
            </AppText>
            <AdvancedCameraMaskedBlurPreview
              active={preferences.advancedChromeEffect === 'cameraMaskedBlur'}
              disabledByTransparency={resolved.accessibility.reduceTransparency}
            />
            <AppText variant="caption" colour="textTertiary">
              Join island — Telegram-style avatar meatball (Skia). Same Preview surface as
              Presence; needs a native rebuild with @shopify/react-native-skia.
            </AppText>
            <ModulaJoinIsland
              name="Modula"
              avatarColour={colours.accent}
              caption="Appearance Advanced motion Preview."
            />
          </Section>

          <AppPressable
            accessibilityLabel="Reset appearance"
            onPress={actions.resetAppearance}
            style={[
              styles.resetButton,
              {
                borderColor: colours.destructive,
                backgroundColor: colours.destructiveSubtle,
                borderRadius: radius.round,
              },
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
              <AppText variant="body" colour="textSecondary">
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
      <AppText variant="headline">{title}</AppText>
      {children}
    </View>
  )
}

function ChromePreview({
  surfaceType,
  onSelectSurface,
}: {
  surfaceType: SurfaceType
  onSelectSurface: (value: SurfaceType) => void
}) {
  const {colours, spacing, radius} = useThemeTokens()
  const selectedPreview = PREVIEW_SURFACES.includes(surfaceType)
    ? surfaceType
    : 'glass'

  return (
    <View style={{gap: spacing[2]}}>
      <View
        style={[
          styles.chromeStage,
          {
            borderRadius: radius.large,
            borderColor: colours.border,
            backgroundColor: colours.surface,
          },
        ]}>
        <LinearGradient
          colors={[colours.accent, colours.canvas, colours.surfaceRaised]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[styles.chromeShade, {backgroundColor: colours.backdrop, opacity: 0.2}]}
        />
        <ProgressiveBlurEdges edgeHeight={48} />

        <View style={styles.bubbleRow}>
          {PREVIEW_SURFACES.map((surface, index) => {
            const selected = selectedPreview === surface
            const opacity = surface === 'solid' ? 0.92 : surface === 'glay' ? 0.62 : 0.4
            return (
              <AppPressable
                key={surface}
                accessibilityLabel={`${surfaceLabels[surface]} chrome preview`}
                accessibilityState={{selected}}
                onPress={() => onSelectSurface(surface)}
                style={[
                  styles.bubble,
                  {
                    borderColor: selected ? colours.text : colours.borderStrong,
                    marginLeft: index === 0 ? 0 : -18,
                    zIndex: PREVIEW_SURFACES.length - index,
                  },
                ]}>
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: colours.surface,
                      opacity: selected ? Math.max(opacity, 0.85) : opacity,
                      borderRadius: 999,
                    },
                  ]}
                />
                {selected ? (
                  <AppIcon name="check" colour={colours.text} size={20} />
                ) : null}
              </AppPressable>
            )
          })}
        </View>
      </View>
      <AppText variant="caption" colour="textTertiary">
        Glass is more transparent chrome; Solid increases opacity for contrast. Preview only —
        not Apple Liquid Glass.
      </AppText>
    </View>
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
  const {colours, spacing, radius} = useThemeTokens()
  const previewMode = mode === 'system' ? 'light' : mode === 'oled' ? 'dark' : mode
  const palette = resolveColourPalette('standard', previewMode)

  return (
    <AppPressable
      accessibilityLabel={`${modeLabels[mode]} mode`}
      accessibilityState={{selected}}
      onPress={onPress}
      style={[styles.modeTileWrap, {gap: spacing[2]}]}>
      <View
        style={[
          styles.modeTile,
          {
            backgroundColor: palette.canvas,
            borderColor: selected ? colours.accent : colours.border,
            borderRadius: radius.large,
            borderWidth: selected ? 2.5 : StyleSheet.hairlineWidth,
          },
        ]}>
        <LinearGradient
          colors={
            mode === 'dark' || mode === 'oled'
              ? [palette.surface1, palette.canvas]
              : mode === 'dim'
                ? [palette.surface2, palette.canvas]
                : [colours.accentSubtle, palette.canvas]
          }
          style={[styles.modeSky, {borderTopLeftRadius: radius.large, borderTopRightRadius: radius.large}]}
        />
        <View style={styles.modeIconWrap}>
          <AppIcon name={modeIcons[mode]} colour={palette.textMain} size={22} />
        </View>
      </View>
      <AppText
        variant="label"
        style={{color: selected ? colours.accent : colours.text, textAlign: 'center'}}>
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
  const {colours, radius} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        styles.choicePill,
        {
          backgroundColor: selected ? colours.accentSubtle : colours.surfaceRaised,
          borderColor: selected ? colours.accent : colours.border,
          borderRadius: radius.round,
        },
      ]}>
      <AppText variant="label" style={{color: selected ? colours.accent : colours.text}}>
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
          styles.swatchRing,
          {
            borderColor: selected ? value : 'transparent',
          },
        ]}>
        <View
          style={[
            styles.swatch,
            {
              backgroundColor: value,
              borderColor: colours.borderStrong,
            },
          ]}>
          {selected ? <AppIcon name="check" colour={colours.accentForeground} size={16} /> : null}
        </View>
      </View>
    </AppPressable>
  )
}

function LinkRow({
  title,
  value,
  onPress,
  last = false,
}: {
  title: string
  value: string
  onPress: () => void
  last?: boolean
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={`${title}, ${value}`}
      onPress={onPress}
      style={[
        styles.linkRow,
        {
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colours.separator,
          gap: spacing[3],
          paddingHorizontal: spacing[4],
        },
      ]}>
      <AppText variant="label" style={{flex: 1}}>
        {title}
      </AppText>
      <AppText variant="caption" colour="textSecondary">
        {value}
      </AppText>
      <AppIcon name="chevronRight" colour={colours.textTertiary} size={16} />
    </AppPressable>
  )
}

function SwitchRow({
  title,
  value,
  storedValue,
  onValueChange,
  deviceOverride = false,
  last = false,
}: {
  title: string
  value: boolean
  storedValue: boolean
  onValueChange: (value: boolean) => void
  deviceOverride?: boolean
  last?: boolean
}) {
  const {preferences} = useAppearance()
  const {colours, spacing} = useThemeTokens()
  return (
    <View
      style={[
        styles.switchRow,
        {
          gap: spacing[3],
          borderBottomColor: colours.separator,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          paddingHorizontal: spacing[4],
        },
      ]}>
      <View style={{flex: 1, gap: spacing[1]}}>
        <AppText variant="label">{title}</AppText>
        {deviceOverride && !storedValue ? (
          <AppText variant="micro" colour="textTertiary">
            Enabled by your device. Modula will keep it active.
          </AppText>
        ) : null}
      </View>
      {preferences.showSwitchLabels ? (
        <AppText variant="micro" colour={value ? 'accent' : 'textTertiary'}>
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

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  bubbleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  choicePill: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chromeShade: {
    ...StyleSheet.absoluteFill,
  },
  chromeStage: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 168,
    overflow: 'hidden',
  },
  content: {
    padding: 16,
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
  expandBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  groupCard: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  linkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 52,
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
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  modeIconWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  modeSky: {
    height: 54,
    width: '100%',
  },
  modeTile: {
    height: 112,
    overflow: 'hidden',
    width: '100%',
  },
  modeTileWrap: {
    width: '47%',
  },
  oledRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
  },
  optionList: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  resetButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 16,
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
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  swatch: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  swatchItem: {
    alignItems: 'center',
  },
  swatchRing: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 3,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  swatchRow: {
    alignItems: 'center',
    paddingRight: 8,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
    paddingVertical: 10,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
