import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const THEMES = [
  {id: 'teal', name: 'Modula Teal', note: 'Default accent'},
  {id: 'forest', name: 'Forest', note: 'Reserved family'},
  {id: 'ocean', name: 'Ocean', note: 'Reserved family'},
  {id: 'espresso', name: 'Espresso', note: 'Reserved family'},
]

const LAYOUTS = [
  {id: 'social', name: 'Social', note: 'Posts first'},
  {id: 'creator', name: 'Creator', note: 'Media + links'},
  {id: 'professional', name: 'Professional', note: 'Modules first'},
  {id: 'minimal', name: 'Minimal', note: 'Quiet chrome'},
]

const DESIGN_DIRECTIONS = [
  {
    id: 'oled-canvas',
    name: 'OLED canvas',
    note: 'True-black canvas direction with restrained glow and strong text contrast.',
  },
  {
    id: 'content-first-chrome',
    name: 'content-first chrome',
    note: 'Liquid Glass-inspired chrome stays around navigation, sheets, and floating controls.',
  },
]

export function ThemesLayoutsStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Themes & Layouts" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Packs for Profile-OS.</AppText>
            <AppText variant="body" colour="textSecondary">
              Themes and layouts will publish as Marketplace modules. Appearance settings already
              control colour mode; packs stay Preview until Registry install.
            </AppText>
          </View>

          <AppText variant="headline">Theme packs</AppText>
          <View style={[styles.grid, {gap: spacing[3]}]}>
            {THEMES.map(theme => (
              <Surface
                key={theme.id}
                variant="contained"
                style={[
                  styles.card,
                  {
                    padding: spacing[4],
                    gap: spacing[2],
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <View
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: theme.id === 'teal' ? colours.accent : colours.accentSubtle,
                      borderRadius: radius.round,
                    },
                  ]}
                />
                <AppText variant="headline">{theme.name}</AppText>
                <AppText variant="caption" colour="textTertiary">
                  {theme.note}
                </AppText>
              </Surface>
            ))}
          </View>

          <AppText variant="headline">Design directions</AppText>
          <View style={[styles.grid, {gap: spacing[3]}]}>
            {DESIGN_DIRECTIONS.map(direction => (
              <Surface
                key={direction.id}
                variant="contained"
                style={[
                  styles.card,
                  {
                    padding: spacing[4],
                    gap: spacing[2],
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <AppIcon
                  name={direction.id === 'oled-canvas' ? 'appearance' : 'modules'}
                  colour={colours.accent}
                />
                <AppText variant="headline">{direction.name}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {direction.note}
                </AppText>
                <AppText variant="micro" colour="textTertiary">
                  Preview note: glass engines remain deferred per theme architecture.
                </AppText>
              </Surface>
            ))}
          </View>

          <AppText variant="headline">Layout packs</AppText>
          <View style={{gap: spacing[2]}}>
            {LAYOUTS.map(layout => (
              <AppPressable
                key={layout.id}
                accessibilityLabel={layout.name}
                onPress={() => router.push('/profile/customize' as Href)}>
                <Surface
                  variant="contained"
                  style={[
                    styles.row,
                    {
                      padding: spacing[4],
                      gap: spacing[3],
                      borderRadius: radius.medium,
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppIcon name="board" colour={colours.accent} />
                  <View style={{flex: 1}}>
                    <AppText variant="headline">{layout.name}</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {layout.note}
                    </AppText>
                  </View>
                  <AppIcon name="chevronRight" colour={colours.textTertiary} size={16} />
                </Surface>
              </AppPressable>
            ))}
          </View>

          <AppButton onPress={() => router.push('/settings/appearance' as Href)}>
            Open Appearance
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/profile/customize' as Href)}>
            Customize profile tabs
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/marketplace/module-themes' as Href)}>
            Themes marketplace card
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  card: {borderWidth: StyleSheet.hairlineWidth, flexBasis: '47%', flexGrow: 1, minWidth: 140},
  swatch: {height: 28, width: 28},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
