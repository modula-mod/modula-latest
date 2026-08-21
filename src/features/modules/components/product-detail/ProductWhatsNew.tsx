import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProductWhatsNew({
  version,
  releaseDate,
  releaseNotes,
  onVersionHistory,
  versionHistoryOpen = false,
}: {
  version: string | null
  releaseDate?: string | null
  releaseNotes: string[]
  onVersionHistory?: () => void
  versionHistoryOpen?: boolean
}) {
  const {colours, spacing} = useThemeTokens()
  const dateLabel = formatReleaseDate(releaseDate)
  return (
    <View style={{gap: spacing[2]}} testID="product-whats-new">
      <View style={styles.headingRow}>
        <AppText variant="sectionTitle" accessibilityRole="header">What&apos;s New</AppText>
        {onVersionHistory ? (
          <AppPressable
            accessibilityLabel={versionHistoryOpen ? 'Hide version history' : 'Open version history'}
            accessibilityState={{expanded: versionHistoryOpen}}
            onPress={onVersionHistory}>
            <AppText variant="caption" colour="accent">Version History →</AppText>
          </AppPressable>
        ) : null}
      </View>
      <AppText variant="caption" colour="textTertiary">
        {version ? `Version ${version}${dateLabel ? ` · ${dateLabel}` : ''}` : 'Release information unavailable'}
      </AppText>
      {releaseNotes.length ? (
        releaseNotes.map((note, index) => (
          <AppText key={`${index}-${note}`} variant="secondaryBody" colour="textSecondary">
            {note}
          </AppText>
        ))
      ) : (
        <AppText variant="secondaryBody" colour="textSecondary">
          Release notes are not available for this registry release.
        </AppText>
      )}
      {versionHistoryOpen && version ? (
        <View style={[styles.history, {borderColor: colours.separator, marginTop: spacing[1], paddingTop: spacing[3]}]}>
          <AppText variant="label">Version {version}</AppText>
          <AppText variant="caption" colour="textSecondary">
            {dateLabel ? `Published ${dateLabel}` : 'Current registry release'}
          </AppText>
        </View>
      ) : null}
    </View>
  )
}

function formatReleaseDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'short', year: 'numeric'}).format(date)
}

const styles = StyleSheet.create({
  headingRow: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
  history: {borderTopWidth: StyleSheet.hairlineWidth, gap: 3},
})
