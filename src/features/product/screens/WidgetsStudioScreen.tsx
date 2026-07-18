import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {BOARD_WIDGET_CATALOG} from '@/features/product/data/boardWidgets'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {selectionHaptic} from '@/lib/haptics'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function WidgetsStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const selected = new Set(preferences.boardWidgetIds)
  const ordered = preferences.boardWidgetIds
    .map(id => BOARD_WIDGET_CATALOG.find(widget => widget.id === id))
    .filter((widget): widget is (typeof BOARD_WIDGET_CATALOG)[number] => Boolean(widget))

  const move = (id: string, direction: -1 | 1) => {
    const ids = [...preferences.boardWidgetIds]
    const index = ids.indexOf(id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return
    ;[ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]]
    void selectionHaptic()
    void update({boardWidgetIds: ids})
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Widgets" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Lightweight blocks for Board & profiles.</AppText>
            <AppText variant="body" colour="textSecondary">
              Toggle and arrange widgets for Board. Order persists locally.
            </AppText>
          </View>

          {ordered.length > 0 ? (
            <View style={{gap: spacing[3]}}>
              <AppText variant="headline">On Board</AppText>
              {ordered.map((widget, index) => (
                <Surface
                  key={widget.id}
                  variant="contained"
                  style={[
                    styles.orderedRow,
                    {
                      padding: spacing[3],
                      gap: spacing[3],
                      borderRadius: radius.medium,
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppIcon name={widget.icon} colour={colours.accent} />
                  <View style={{flex: 1, gap: 2}}>
                    <AppText variant="headline">{widget.name}</AppText>
                    <AppText variant="caption" colour="textTertiary">
                      {widget.size} · #{index + 1}
                    </AppText>
                  </View>
                  <AppPressable
                    accessibilityLabel={`Move ${widget.name} up`}
                    disabled={index === 0}
                    onPress={() => move(widget.id, -1)}
                    style={[styles.arrow, {opacity: index === 0 ? 0.35 : 1}]}>
                    <AppIcon name="arrowUp" colour={colours.textSecondary} size={18} />
                  </AppPressable>
                  <AppPressable
                    accessibilityLabel={`Move ${widget.name} down`}
                    disabled={index === ordered.length - 1}
                    onPress={() => move(widget.id, 1)}
                    style={[
                      styles.arrow,
                      {opacity: index === ordered.length - 1 ? 0.35 : 1},
                    ]}>
                    <AppIcon name="arrowDown" colour={colours.textSecondary} size={18} />
                  </AppPressable>
                </Surface>
              ))}
            </View>
          ) : null}

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
  orderedRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  arrow: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
})
