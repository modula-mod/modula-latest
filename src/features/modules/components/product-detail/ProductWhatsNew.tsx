import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProductWhatsNew({
  version,
  releaseNotes,
  onVersionHistory,
}: {
  version: string | null
  releaseNotes: string[]
  onVersionHistory?: () => void
}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}} testID="product-whats-new">
      <View style={styles.headingRow}>
        <AppText variant="headline" accessibilityRole="header">What&apos;s New</AppText>
        {onVersionHistory ? (
          <AppPressable accessibilityLabel="Open version history" onPress={onVersionHistory}>
            <AppText variant="caption" colour="accent">Version History</AppText>
          </AppPressable>
        ) : null}
      </View>
      <AppText variant="caption" colour="textTertiary">
        {version ? `Version ${version}` : 'Release information unavailable'}
      </AppText>
      {releaseNotes.length ? (
        releaseNotes.map((note, index) => (
          <AppText key={`${index}-${note}`} variant="body" colour="textSecondary">
            {note}
          </AppText>
        ))
      ) : (
        <AppText variant="body" colour="textSecondary">
          Release notes are not available for this registry release.
        </AppText>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  headingRow: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
})
