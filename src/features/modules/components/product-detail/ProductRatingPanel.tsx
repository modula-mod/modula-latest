import {ActivityIndicator, StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {GreenfieldModuleRatingAggregate} from '@/data/repositories/contracts'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProductRatingPanel({
  rating,
  canRate,
  selectedRating,
  busy = false,
  onRate,
}: {
  rating: GreenfieldModuleRatingAggregate
  canRate: boolean
  selectedRating?: number | null
  busy?: boolean
  onRate: (rating: number) => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const summary = rating.average === null
    ? 'No ratings yet'
    : `${rating.average.toFixed(1)} from ${rating.count.toLocaleString()} ${rating.count === 1 ? 'rating' : 'ratings'}`
  return (
    <View style={{gap: spacing[3]}} testID="product-rating-panel">
      <AppText variant="sectionTitle" accessibilityRole="header">Ratings</AppText>
      <View
        style={[
          styles.panel,
          {
            backgroundColor: colours.surface,
            borderColor: colours.border,
            borderRadius: radius.xlarge,
            gap: spacing[3],
          },
        ]}>
        <View style={{gap: spacing[1]}}>
          <AppText variant="metricValue">{summary}</AppText>
          <AppText variant="secondaryBody" colour="textSecondary">
            Ratings are submitted by signed-in Modula accounts. Written reviews are not available yet.
          </AppText>
        </View>
        {canRate ? (
          <View accessibilityLabel="Rate this module from 1 to 5" style={[styles.choices, {gap: spacing[2]}]}>
            {[1, 2, 3, 4, 5].map(value => {
              const selected = selectedRating === value
              return (
                <AppPressable
                  key={value}
                  accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`}
                  accessibilityState={{selected, disabled: busy}}
                  disabled={busy}
                  onPress={() => onRate(value)}
                  style={[
                    styles.choice,
                    {
                      backgroundColor: selected ? colours.accentSubtle : colours.surfaceRaised,
                      borderColor: selected ? colours.accent : colours.border,
                      borderRadius: radius.round,
                    },
                  ]}>
                  <AppText variant="label" colour={selected ? 'accent' : 'textSecondary'}>{value}★</AppText>
                </AppPressable>
              )
            })}
            {busy ? <ActivityIndicator accessibilityLabel="Saving rating" color={colours.accent} /> : null}
          </View>
        ) : (
          <AppText variant="caption" colour="textTertiary">Sign in to rate this module.</AppText>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  choice: {alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 44, minWidth: 48, paddingHorizontal: 10},
  choices: {alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap'},
  panel: {borderWidth: StyleSheet.hairlineWidth, padding: 16},
})
