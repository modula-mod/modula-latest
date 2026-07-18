import {useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type Principle = {
  id: string
  label: string
  source: string
  title: string
  summary: string
  detail: string
  checks: string[]
  icon: AppIconName
}

type ModePreview = {
  id: string
  label: string
  summary: string
}

type LabLink = {
  id: string
  label: string
  summary: string
  route: string
  icon: AppIconName
}

const PRINCIPLES: Principle[] = [
  {
    id: 'density',
    label: 'Feed density',
    source: 'X / Twitter remap',
    title: 'Content-first feed densification',
    summary: 'Text breathes, media glows, links contain.',
    detail:
      'Dense social rows should reduce chrome without flattening hierarchy. Hairlines, readable text, and stronger media treatment carry the scan pattern.',
    checks: ['Use hairline separators', 'Keep post text readable', 'Reserve raised cards for grouped modules'],
    icon: 'text',
  },
  {
    id: 'modes',
    label: 'Mode bar',
    source: 'X / Twitter remap',
    title: 'Following / For You / Modules',
    summary: 'A familiar mode switch gains a Modula-only third rail.',
    detail:
      'Following and For You are social contexts. Modules is the differentiator: registered workspaces, Profile-OS tabs, and module feeds can become first-class modes.',
    checks: ['Do not clone ranking UI', 'Expose Modules as a product layer', 'Keep controls accessible'],
    icon: 'switch',
  },
  {
    id: 'glass',
    label: 'Liquid Glass',
    source: 'Apple HIG remap',
    title: 'Glass belongs to navigation',
    summary: 'Tab bars and sheets can float; content remains solid.',
    detail:
      'Glass should clarify spatial layers. Posts, rows, forms, and module content stay solid so Reduce Transparency and OLED readability remain reliable.',
    checks: ['Glass chrome only', 'Solid content surfaces', 'Reduce Transparency fallback'],
    icon: 'appearance',
  },
  {
    id: 'feedback',
    label: 'Micro-feedback',
    source: 'Social action remap',
    title: 'Small responses, honest state',
    summary: 'Tap feedback can feel alive without faking remote success.',
    detail:
      'Action rows should acknowledge local intent quickly while making disabled, pending, or preview-only states obvious.',
    checks: ['Show selected state', 'Avoid fake success', 'Keep counts and reactions calm'],
    icon: 'activity',
  },
  {
    id: 'brand',
    label: 'Brand boundary',
    source: 'Modula product rule',
    title: 'Modula Teal, Profile-OS, modules',
    summary: 'The lab remaps inspiration; it is not a design-system fork.',
    detail:
      'Modula Teal #369CAA, OLED canvas, Profile-OS, and modules define the product. No Chirp, X logo, X Blue clone, Bluesky ALF, or copied design systems.',
    checks: ['Use theme tokens', 'Keep Profile-OS visible', 'Name forbidden-copy boundaries'],
    icon: 'security',
  },
]

const MODE_PREVIEW: ModePreview[] = [
  {
    id: 'following',
    label: 'Following',
    summary: 'People and communities the user explicitly asked to see.',
  },
  {
    id: 'for-you',
    label: 'For You',
    summary: 'Discovery preview with honest ranking controls and focus-aware quieting.',
  },
  {
    id: 'modules',
    label: 'Modules',
    summary: 'Registered module streams, workspaces, and Profile-OS surfaces.',
  },
]

const LAB_LINKS: LabLink[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    summary: 'Theme tokens, colour modes, Surface Types, and Reduce Transparency direction.',
    route: '/settings/appearance',
    icon: 'appearance',
  },
  {
    id: 'focus',
    label: 'Focus',
    summary: 'Attention policy preview for Home, Board, messaging, presence, and GAIA.',
    route: '/product/focus',
    icon: 'contrast',
  },
  {
    id: 'home',
    label: 'Home',
    summary: 'Content-first social surface where density, hairlines, and action feedback meet.',
    route: '/',
    icon: 'home',
  },
  {
    id: 'product',
    label: 'Product Hub',
    summary: 'Catalogue view for honest product maturity and related preview surfaces.',
    route: '/product',
    icon: 'modules',
  },
]

export function DesignLabScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const [selectedId, setSelectedId] = useState(PRINCIPLES[0].id)
  const [modeId, setModeId] = useState(MODE_PREVIEW[2].id)
  const selected = PRINCIPLES.find(item => item.id === selectedId) ?? PRINCIPLES[0]
  const activeMode = MODE_PREVIEW.find(item => item.id === modeId) ?? MODE_PREVIEW[0]

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Design Lab" />
      <ResponsiveContent maxWidth={760}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colours.surface,
                borderColor: colours.accentBorder,
                borderRadius: radius.large,
                padding: spacing[5],
                gap: spacing[3],
              },
            ]}>
            <AppText variant="caption" colour="accent">
              PRODUCT DESIGN LAB PREVIEW
            </AppText>
            <AppText variant="display">Inspiration remapped to Modula.</AppText>
            <AppText variant="body" colour="textSecondary">
              This preview turns inspiration principles into product conversation pieces. It is
              honest about scope: not a design-system fork, not an X clone, and not a Liquid Glass
              implementation pass.
            </AppText>
          </View>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Principle chips</AppText>
            <View style={[styles.chipWrap, {gap: spacing[2]}]}>
              {PRINCIPLES.map(item => {
                const active = item.id === selectedId
                return (
                  <AppPressable
                    key={item.id}
                    accessibilityLabel={`Show ${item.label}`}
                    accessibilityState={{selected: active}}
                    onPress={() => setSelectedId(item.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colours.accentSubtle : colours.surface,
                        borderColor: active ? colours.accent : colours.border,
                        borderRadius: radius.full,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                      },
                    ]}>
                    <AppText variant="caption" colour={active ? 'accent' : 'textSecondary'}>
                      {item.label}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.principleCard,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.large,
                padding: spacing[4],
                gap: spacing[3],
              },
            ]}>
            <View style={[styles.titleRow, {gap: spacing[3]}]}>
              <View
                style={[
                  styles.iconBubble,
                  {
                    backgroundColor: colours.accentSubtle,
                    borderColor: colours.accentBorder,
                    borderRadius: radius.full,
                  },
                ]}>
                <AppIcon name={selected.icon} colour={colours.accent} />
              </View>
              <View style={{flex: 1, gap: spacing[1]}}>
                <AppText variant="caption" colour="accent">
                  {selected.source}
                </AppText>
                <AppText variant="title">{selected.title}</AppText>
              </View>
            </View>
            <AppText variant="bodyStrong">{selected.summary}</AppText>
            <AppText variant="body" colour="textSecondary">
              {selected.detail}
            </AppText>
            <View style={{gap: spacing[2]}}>
              {selected.checks.map(check => (
                <View key={check} style={[styles.checkRow, {gap: spacing[2]}]}>
                  <AppIcon name="check" colour={colours.accent} size={16} />
                  <AppText variant="caption" colour="textSecondary" style={{flex: 1}}>
                    {check}
                  </AppText>
                </View>
              ))}
            </View>
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Mode bar preview</AppText>
            <Surface
              variant="contained"
              style={[
                styles.modeCard,
                {
                  backgroundColor: colours.surfaceRaised,
                  borderColor: colours.border,
                  borderRadius: radius.large,
                  padding: spacing[3],
                  gap: spacing[3],
                },
              ]}>
              <View style={[styles.modeBar, {gap: spacing[2]}]}>
                {MODE_PREVIEW.map(mode => {
                  const active = mode.id === modeId
                  return (
                    <AppPressable
                      key={mode.id}
                      accessibilityLabel={`Preview ${mode.label} mode`}
                      accessibilityState={{selected: active}}
                      onPress={() => setModeId(mode.id)}
                      style={[
                        styles.modePill,
                        {
                          backgroundColor: active ? colours.accent : colours.surface,
                          borderColor: active ? colours.accent : colours.border,
                          borderRadius: radius.full,
                          paddingHorizontal: spacing[3],
                          paddingVertical: spacing[2],
                        },
                      ]}>
                      <AppText
                        variant="caption"
                        colour={active ? 'accentForeground' : 'textSecondary'}>
                        {mode.label}
                      </AppText>
                    </AppPressable>
                  )
                })}
              </View>
              <AppText variant="body" colour="textSecondary">
                {activeMode.summary}
              </AppText>
            </Surface>
          </View>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Open related surfaces</AppText>
            <View style={[styles.linkGrid, {gap: spacing[3]}]}>
              {LAB_LINKS.map(link => (
                <AppPressable
                  key={link.id}
                  accessibilityLabel={`Open ${link.label}`}
                  onPress={() => router.push(link.route as Href)}
                  style={[
                    styles.linkCard,
                    {
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                      borderRadius: radius.large,
                      padding: spacing[4],
                      gap: spacing[2],
                    },
                  ]}>
                  <AppIcon name={link.icon} colour={colours.accent} />
                  <AppText variant="headline">{link.label}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {link.summary}
                  </AppText>
                  <View style={[styles.ctaRow, {gap: spacing[1]}]}>
                    <AppText variant="caption" colour="accent">
                      Open
                    </AppText>
                    <AppIcon name="chevronRight" colour={colours.accent} size={14} />
                  </View>
                </AppPressable>
              ))}
            </View>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.note,
              {
                backgroundColor: colours.accentSubtle,
                borderColor: colours.accentBorder,
                borderRadius: radius.medium,
                padding: spacing[4],
                gap: spacing[2],
              },
            ]}>
            <AppText variant="label" colour="accent">
              Honesty boundary
            </AppText>
            <AppText variant="caption" colour="textSecondary">
              Docs live in `docs/design/`. The lab previews principles only; production material
              engines, ranking policy, and module feed runtime remain separate implementation work.
            </AppText>
          </Surface>

          <AppButton onPress={() => router.push('/product' as Href)}>Back to Product Hub</AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {borderWidth: StyleSheet.hairlineWidth},
  chipWrap: {flexDirection: 'row', flexWrap: 'wrap'},
  chip: {borderWidth: StyleSheet.hairlineWidth},
  principleCard: {borderWidth: StyleSheet.hairlineWidth},
  titleRow: {alignItems: 'center', flexDirection: 'row'},
  iconBubble: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  checkRow: {alignItems: 'center', flexDirection: 'row'},
  modeCard: {borderWidth: StyleSheet.hairlineWidth},
  modeBar: {flexDirection: 'row', flexWrap: 'wrap'},
  modePill: {borderWidth: StyleSheet.hairlineWidth},
  linkGrid: {flexDirection: 'row', flexWrap: 'wrap'},
  linkCard: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 150,
    minWidth: 150,
  },
  ctaRow: {alignItems: 'center', flexDirection: 'row'},
  note: {borderWidth: StyleSheet.hairlineWidth},
})
