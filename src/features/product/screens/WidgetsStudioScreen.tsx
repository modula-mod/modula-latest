import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {BOARD_WIDGET_CATALOG} from '@/features/product/data/boardWidgets'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function WidgetsStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const selected = new Set(preferences.boardWidgetIds)

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Widgets" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Lightweight blocks for Board & profiles.</AppText>
            <AppText variant="body" colour="textSecondary">
              Toggle widgets for Board. Selection persists locally.
            </AppText>
          </View>

          <View style={[styles.grid, {gap: spacing[3]}]}>
            {BOARD_WIDGET_CATALOG.map(widget => {
              const on = selected.has(widget.id)
              return (
                <AppPressable
                  key={widget.id}
                  accessibilityLabel={`${on ? 'Remove' : 'Add'} ${widget.name}`}
                  onPress={() => {
                    const next = on
                      ? preferences.boardWidgetIds.filter(id => id !== widget.id)
                      : [...preferences.boardWidgetIds, widget.id]
                    void update({boardWidgetIds: next})
                  }}
                  style={[
                    styles.card,
                    {
                      padding: spacing[4],
                      gap: spacing[2],
                      borderRadius: radius.large,
                      backgroundColor: on ? colours.accentSubtle : colours.surface,
                      borderColor: on ? colours.accent : colours.border,
                      minHeight: widget.size.startsWith('2×2') ? 160 : 120,
                      flexBasis: widget.size.startsWith('2') ? '100%' : '47%',
                    },
                  ]}>
                  <AppIcon name={widget.icon} colour={colours.accent} />
                  <AppText variant="headline">{widget.name}</AppText>
                  <AppText variant="caption" colour="textTertiary">
                    {widget.size} · {on ? 'On Board' : 'Off'}
                  </AppText>
                </AppPressable>
              )
            })}
          </View>

          <AppButton onPress={() => router.push('/board' as Href)}>Open Board</AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  card: {borderWidth: StyleSheet.hairlineWidth, flexGrow: 1, minWidth: 140},
})
