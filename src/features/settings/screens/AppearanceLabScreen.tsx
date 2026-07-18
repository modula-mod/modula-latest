import type {ReactNode} from 'react'
import {ScrollView, StyleSheet, Switch, TextInput, View} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import type {
  AccentId,
  AppearanceMode,
  SurfaceType,
  ThemeFamily,
} from '@/theme/contracts'
import {SURFACE_ROLES, SURFACE_TYPES} from '@/theme/contracts'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useAppearanceActions} from '@/theme/runtime/useAppearanceActions'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type Preset = {
  label: string
  mode?: AppearanceMode
  family?: ThemeFamily
  accentId?: AccentId
  surfaceType?: SurfaceType
  increaseContrast?: boolean
  reduceTransparency?: boolean
  reduceMotion?: boolean
}

const presets: Preset[] = [
  {label: 'Standard Light + Solid', mode: 'light', family: 'standard', surfaceType: 'solid'},
  {label: 'Standard Dim + Minimal Spatial', mode: 'dim', family: 'standard', surfaceType: 'minimalSpatial'},
  {label: 'Standard Dark + Glass', mode: 'dark', family: 'standard', surfaceType: 'glass'},
  {label: 'Ocean OLED + Glass', mode: 'oled', family: 'ocean', surfaceType: 'glass'},
  {label: 'Forest Dark + Glay', mode: 'dark', family: 'forest', surfaceType: 'glay'},
  {label: 'Plum Dark + Neomorphic', mode: 'dark', family: 'plum', surfaceType: 'neomorphic'},
  {label: 'Espresso Dark + Skeuomorphic', mode: 'dark', family: 'espresso', surfaceType: 'skeuomorphic'},
  {label: 'Native Current Platform', surfaceType: 'native'},
  {label: 'High Contrast', increaseContrast: true},
  {label: 'Reduced Transparency', reduceTransparency: true},
  {label: 'Reduced Motion', reduceMotion: true},
]

const surfacePreviewNotes: Record<SurfaceType, string> = {
  native: 'Native asks the platform for material chrome when supported, then falls back through MaterialSurface.',
  solid: 'Solid keeps opaque cards and controls as the stable accessibility baseline.',
  glass: 'Glass is a Liquid Glass-inspired chrome direction for bars, sheets, and floating controls only.',
  glay: 'Glay explores grey glass tone and softened depth without turning content panes translucent.',
  minimalSpatial: 'Minimal Spatial uses quiet separation and restrained elevation so content stays first.',
  skeuomorphic: 'Skeuomorphic reserves tactile highlights for controls; it must not change IA or layout.',
  neomorphic: 'Neomorphic reserves raised controls for places where dark/OLED contrast remains safe.',
}

export function AppearanceLabScreen() {
  const {resolved} = useAppearance()
  const actions = useAppearanceActions()
  const {colours, spacing, typography} = useThemeTokens()

  const applyPreset = (preset: Preset) => {
    if (preset.mode) actions.setMode(preset.mode)
    if (preset.family) actions.setThemeFamily(preset.family)
    if (preset.accentId) actions.setAccent(preset.accentId)
    if (preset.surfaceType) actions.setSurfaceType(preset.surfaceType)
    if (typeof preset.increaseContrast === 'boolean') {
      actions.setIncreaseContrast(preset.increaseContrast)
    }
    if (typeof preset.reduceTransparency === 'boolean') {
      actions.setReduceTransparency(preset.reduceTransparency)
    }
    if (typeof preset.reduceMotion === 'boolean') {
      actions.setReduceMotion(preset.reduceMotion)
    }
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Appearance Lab" />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Appearance Lab</AppText>
            <AppText variant="body" colour="textSub">
              Inspect token behaviour, material contracts, and accessibility
              fallbacks inside the live runtime. Glass previews are chrome-only;
              the unfinished engines are deferred per theme architecture.
            </AppText>
          </View>

          <LabSection title="Quick presets" icon="palette">
            <View style={[styles.wrap, {gap: spacing[2]}]}>
              {presets.map(preset => (
                <AppPressable
                  key={preset.label}
                  accessibilityLabel={preset.label}
                  onPress={() => applyPreset(preset)}
                  style={[
                    styles.preset,
                    {
                      backgroundColor: colours.surface1,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppText variant="label">{preset.label}</AppText>
                </AppPressable>
              ))}
              <AppPressable
                accessibilityLabel="Reset appearance"
                onPress={actions.resetAppearance}
                style={[
                  styles.preset,
                  {
                    backgroundColor: colours.destructiveSubtle,
                    borderColor: colours.destructive,
                  },
                ]}>
                <AppText variant="label" style={{color: colours.destructive}}>
                  Reset
                </AppText>
              </AppPressable>
            </View>
          </LabSection>

          <LabSection title="Surface Type preview notes" icon="appearance">
            <MaterialSurface role="card" style={[styles.panel, {gap: spacing[3]}]}>
              <AppText variant="body" colour="textSub">
                Surface Type changes material treatment, not navigation, hierarchy, or content
                order. Product design lab: /product/design-lab.
              </AppText>
              <AppText variant="caption" colour="textMuted">
                Docs: docs/product/theme-architecture-v5.md and
                docs/architecture/surface-type-contract.md.
              </AppText>
              <View style={[styles.noteGrid, {gap: spacing[2]}]}>
                {SURFACE_TYPES.map(surfaceType => (
                  <View
                    key={surfaceType}
                    style={[
                      styles.noteCard,
                      {backgroundColor: colours.surface1, borderColor: colours.border},
                    ]}>
                    <AppText variant="label">{labelSurface(surfaceType)}</AppText>
                    <AppText variant="micro" colour="textMuted">
                      {surfacePreviewNotes[surfaceType]}
                    </AppText>
                  </View>
                ))}
              </View>
              <View
                style={[
                  styles.callout,
                  {backgroundColor: colours.accentSubtle, borderColor: colours.accentBorder},
                ]}>
                <AppIcon name="info" colour={colours.accent} size={18} />
                <AppText variant="caption" colour="textSub" style={{flex: 1}}>
                  Reduce Transparency wins over Native, Glass, and Glay by forcing opaque,
                  non-glass treatment.
                </AppText>
              </View>
            </MaterialSurface>
          </LabSection>

          <LabSection title="Colour tokens" icon="appearance">
            <View style={[styles.tokenGrid, {gap: spacing[2]}]}>
              {Object.entries(colours)
                .filter(([, value]) => typeof value === 'string')
                .map(([name, value]) => (
                  <View
                    key={name}
                    style={[
                      styles.token,
                      {borderColor: colours.border, backgroundColor: colours.surface1},
                    ]}>
                    <View
                      style={[
                        styles.tokenSwatch,
                        {backgroundColor: value, borderColor: colours.borderStrong},
                      ]}
                    />
                    <View style={{flex: 1}}>
                      <AppText variant="micro" numberOfLines={1}>
                        {name}
                      </AppText>
                      <AppText variant="micro" colour="textMuted" numberOfLines={1}>
                        {value}
                      </AppText>
                    </View>
                  </View>
                ))}
            </View>
          </LabSection>

          <LabSection title="Typography" icon="text">
            <MaterialSurface role="card" style={[styles.panel, {gap: spacing[3]}]}>
              {Object.entries(typography).map(([role, token]) => (
                <View key={role} style={styles.typographyRow}>
                  <AppText variant={role as keyof typeof typography}>
                    {role} text
                  </AppText>
                  <AppText variant="micro" colour="textMuted">
                    {token.fontSize}/{token.lineHeight} {token.fontWeight}
                  </AppText>
                </View>
              ))}
            </MaterialSurface>
          </LabSection>

          <LabSection title="Buttons, inputs, switches" icon="switch">
            <MaterialSurface role="card" style={[styles.panel, {gap: spacing[3]}]}>
              <View style={[styles.row, {gap: spacing[2]}]}>
                <AppPressable
                  accessibilityLabel="Primary sample"
                  style={[
                    styles.button,
                    {backgroundColor: colours.accent, borderColor: colours.accent},
                  ]}>
                  <AppText variant="label" colour="accentForeground">
                    Primary
                  </AppText>
                </AppPressable>
                <AppPressable
                  accessibilityLabel="Secondary sample"
                  style={[
                    styles.button,
                    {backgroundColor: colours.surface2, borderColor: colours.border},
                  ]}>
                  <AppText variant="label">Secondary</AppText>
                </AppPressable>
              </View>
              <TextInput
                accessibilityLabel="Input sample"
                placeholder="Input sample"
                placeholderTextColor={colours.textMuted}
                style={[
                  styles.input,
                  {
                    color: colours.textMain,
                    backgroundColor: colours.surface1,
                    borderColor: colours.border,
                  },
                ]}
              />
              <View style={styles.row}>
                <AppText variant="body">Switch sample</AppText>
                <Switch
                  value
                  trackColor={{false: colours.surface3, true: colours.accentSubtle}}
                  thumbColor={colours.accent}
                />
              </View>
            </MaterialSurface>
          </LabSection>

          <LabSection title="Material roles" icon="modules">
            <View style={[styles.roleGrid, {gap: spacing[3]}]}>
              {SURFACE_ROLES.map(role => (
                <MaterialSurface key={role} role={role} style={[styles.roleCard, {gap: spacing[2]}]}>
                  <AppText variant="label">{role}</AppText>
                  <AppText variant="micro" colour="textMuted">
                    blur {resolved.materials[role].blurIntensity} · radius{' '}
                    {resolved.materials[role].radius}
                  </AppText>
                </MaterialSurface>
              ))}
            </View>
          </LabSection>

          <LabSection title="Content fragments" icon="home">
            <View style={{gap: spacing[3]}}>
              <TextPostFragment />
              <MediaPostFragment />
              <ModuleCardFragment />
              <DrawerFragment />
              <AlertFragment />
            </View>
          </LabSection>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function LabSection({
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
        <AppIcon name={icon} colour={colours.accent} />
        <AppText variant="title2">{title}</AppText>
      </View>
      {children}
    </View>
  )
}

function TextPostFragment() {
  const {spacing} = useThemeTokens()
  return (
    <View style={[styles.postOpen, {gap: spacing[3]}]}>
      <Avatar name="Ari" size={38} />
      <View style={{flex: 1, gap: spacing[1]}}>
        <AppText variant="label">Text post</AppText>
        <AppText variant="body" colour="textSub">
          Text posts stay visually open and rely on rhythm, not heavy cards.
        </AppText>
      </View>
    </View>
  )
}

function MediaPostFragment() {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}}>
      <AppText variant="label">Media post</AppText>
      <View
        style={[
          styles.media,
          {backgroundColor: colours.mediaGlowFallback, borderColor: colours.accentBorder},
        ]}>
        <AppIcon name="play" colour={colours.accent} />
      </View>
    </View>
  )
}

function ModuleCardFragment() {
  const {colours, spacing} = useThemeTokens()
  return (
    <MaterialSurface role="card" style={[styles.panel, styles.row, {gap: spacing[3]}]}>
      <AppIcon name="modules" colour={colours.accent} />
      <View style={{flex: 1}}>
        <AppText variant="label">Module card</AppText>
        <AppText variant="caption" colour="textSub">
          Installed into the profile surface.
        </AppText>
      </View>
      <AppText variant="caption" colour="accent">
        Open
      </AppText>
    </MaterialSurface>
  )
}

function DrawerFragment() {
  const {colours, spacing} = useThemeTokens()
  return (
    <MaterialSurface role="modal" style={[styles.panel, {gap: spacing[2]}]}>
      {['Board', 'Modules', 'Marketplace', 'Settings'].map(item => (
        <View key={item} style={[styles.row, {gap: spacing[2]}]}>
          <AppIcon name="chevronRight" colour={colours.textMuted} size={16} />
          <AppText variant="body">{item}</AppText>
        </View>
      ))}
    </MaterialSurface>
  )
}

function AlertFragment() {
  const {colours, spacing} = useThemeTokens()
  return (
    <MaterialSurface role="card" style={[styles.panel, styles.row, {gap: spacing[3]}]}>
      <AppIcon name="warning" colour={colours.warning} />
      <View style={{flex: 1}}>
        <AppText variant="label">Alert</AppText>
        <AppText variant="caption" colour="textSub">
          Warnings keep strong contrast in every surface mode.
        </AppText>
      </View>
    </MaterialSurface>
  )
}

function labelSurface(surfaceType: SurfaceType): string {
  return surfaceType.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  callout: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  media: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  noteCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    padding: 12,
    width: '48%',
  },
  noteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  panel: {
    padding: 16,
  },
  postOpen: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  preset: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  roleCard: {
    minHeight: 78,
    padding: 12,
    width: '47%',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  screen: {
    flex: 1,
  },
  sectionTitle: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  token: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    width: '48%',
  },
  tokenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tokenSwatch: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    height: 28,
    width: 28,
  },
  typographyRow: {
    gap: 2,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
