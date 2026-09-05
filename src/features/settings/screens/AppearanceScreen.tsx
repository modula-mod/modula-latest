import {LinearGradient} from 'expo-linear-gradient'
import type {ReactNode} from 'react'
import {useMemo, useState} from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'

import {ProgressiveBlurEdges} from '@/components/materials/ProgressiveBlurEdges'
import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {AdvancedCameraMaskedBlurPreview} from '@/features/settings/components/AdvancedCameraMaskedBlurPreview'
import {SettingsLinkRow, SettingsSection, SettingsToggleRow} from '@/features/settings/components/SettingsRows'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
import {ModulaIcon} from '@/platform/ui/icons'
import {ModulaJoinIsland} from '@/platform/ui/motion'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {validateCustomAccent} from '@/theme/accents'
import {ACCENT_PRESETS} from '@/theme/accents/resolveAccent'
import {
  SURFACE_TYPES,
  THEME_FAMILIES,
  type AppearanceMode,
  type SurfaceType,
  type ThemeFamily,
} from '@/theme/contracts'
import {resolveColourPalette} from '@/theme/palettes'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Primary mode tiles — dark depth (Dim/Dark/OLED) uses a native segmented control. */
const PRIMARY_MODES: AppearanceMode[] = ['system', 'light', 'dark']

function isDarkDepth(mode: AppearanceMode): boolean {
  return mode === 'dim' || mode === 'dark' || mode === 'oled'
}

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
  const {preferences, resolved} = useAppearance()
  const actions = useAppearanceActions()
  const {colours, spacing, radius} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const [customModalVisible, setCustomModalVisible] = useState(false)
  const [familiesOpen, setFamiliesOpen] = useState(false)
  const [surfacesOpen, setSurfacesOpen] = useState(false)
  const [customInput, setCustomInput] = useState(
    preferences.customAccent ?? resolved.accent.base,
  )
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
            Colour, materials, and how Modula looks on this device.
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
                  selected={
                    mode === 'dark'
                      ? isDarkDepth(preferences.mode)
                      : preferences.mode === mode
                  }
                  onPress={() => {
                    if (mode === 'dark') {
                      actions.setMode(isDarkDepth(preferences.mode) ? preferences.mode : 'dark')
                      return
                    }
                    actions.setMode(mode)
                  }}
                />
              ))}
            </View>
            {isDarkDepth(preferences.mode) ? (
              <View style={{gap: spacing[2]}}>
                <AppText variant="caption" colour="textTertiary">
                  Dark depth
                </AppText>
                <ModulaSegmentedPicker
                  appearance="segmented"
                  accessibilityLabel="Dark depth"
                  testID="appearance-dark-depth"
                  options={[
                    {value: 'dim', label: 'Dim'},
                    {value: 'dark', label: 'Dark'},
                    {value: 'oled', label: 'OLED'},
                  ]}
                  value={preferences.mode}
                  onValueChange={next => {
                    if (next === 'dim' || next === 'dark' || next === 'oled') {
                      actions.setMode(next)
                    }
                  }}
                />
              </View>
            ) : null}
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
                  Choose how toolbars and grouped surfaces appear.
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

          <SettingsSection>
            <SettingsLinkRow
              row={{
                title: 'Display & Text Size',
                icon: 'text',
                iconDomain: 'language',
                route: '/settings/display-and-text',
              }}
              last
            />
          </SettingsSection>

          <SettingsSection
            title="Advanced"
            footer="Uses the live camera behind supported chrome. Nothing is recorded. Reduce Transparency disables the blur layer.">
            <SettingsToggleRow
              label="Camera masked blur"
              value={preferences.advancedChromeEffect === 'cameraMaskedBlur'}
              onValueChange={enabled => {
                actions.setAdvancedChromeEffect(enabled ? 'cameraMaskedBlur' : 'off')
              }}
              last
            />
          </SettingsSection>
          <AdvancedCameraMaskedBlurPreview
            active={preferences.advancedChromeEffect === 'cameraMaskedBlur'}
            disabledByTransparency={resolved.accessibility.reduceTransparency}
          />
          <AppText variant="caption" colour="textTertiary">
            Preview a compact group-call control using the current appearance settings.
          </AppText>
          <ModulaJoinIsland
            name="Modula"
            avatarColour={colours.accent}
            caption="Appearance Advanced motion Preview."
          />

          <ModulaButton
            accessibilityLabel="Reset appearance"
            label="Reset Appearance"
            role="destructive"
            size="compact"
            onPress={actions.resetAppearance}
          />
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
              <ModulaTextInput
                value={customInput}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="Custom accent hex colour"
                placeholder={resolved.accent.base}
                onChangeText={setCustomInput}
                style={{
                  borderColor: customValidation.valid
                    ? colours.border
                    : colours.destructive,
                }}
              />
            </View>
            {customValidation.message ? (
              <AppText variant="caption" style={{color: colours.destructive}}>
                {customValidation.message}
              </AppText>
            ) : null}
            <View style={[styles.modalActions, {gap: spacing[2]}]}>
              <ModulaButton
                accessibilityLabel="Cancel custom accent"
                label="Cancel"
                role="secondary"
                size="compact"
                onPress={() => setCustomModalVisible(false)}
              />
              <ModulaButton
                accessibilityLabel="Apply custom accent"
                label="Apply"
                disabled={!customValidation.valid}
                size="compact"
                onPress={() => {
                  if (customValidation.valid) {
                    actions.setCustomAccent(customValidation.value)
                    setCustomModalVisible(false)
                  }
                }}
              />
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
                  <ModulaIcon name="check" colour={colours.text} size={20} />
                ) : null}
              </AppPressable>
            )
          })}
        </View>
      </View>
      <AppText variant="caption" colour="textTertiary">
        Compare transparent and solid chrome against the same content.
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
          <ModulaIcon name={modeIcons[mode]} colour={palette.textMain} size={22} />
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
          {selected ? <ModulaIcon name="check" colour={colours.accentForeground} size={16} /> : null}
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
  const {colours, controls, spacing} = useThemeTokens()
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
          minHeight: controls.listRow.minimum,
          paddingHorizontal: spacing[4],
        },
      ]}>
      <AppText variant="label" style={{flex: 1}}>
        {title}
      </AppText>
      <AppText variant="caption" colour="textSecondary">
        {value}
      </AppText>
      <ModulaIcon name="chevronRight" colour={colours.textTertiary} size={16} />
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  bubbleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
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
    minHeight: 104,
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
    height: 42,
    width: 42,
  },
  expandBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  groupCard: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  linkRow: {
    alignItems: 'center',
    flexDirection: 'row',
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
    height: 36,
    width: '100%',
  },
  modeTile: {
    height: 84,
    overflow: 'hidden',
    width: '100%',
  },
  modeTileWrap: {
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 92,
  },
  screen: {
    flex: 1,
  },
  swatch: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  swatchItem: {
    alignItems: 'center',
  },
  swatchRing: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 3,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  swatchRow: {
    alignItems: 'center',
    paddingRight: 8,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
