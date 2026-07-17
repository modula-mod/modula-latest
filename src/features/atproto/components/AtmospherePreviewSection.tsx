import {StyleSheet, View} from 'react-native'

import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import {OriginLabel} from '@/features/atproto/components/OriginLabel'
import {ATMOSPHERE_PREVIEW_LABEL} from '@/features/atproto/copy'
import {useAtmosphereFeedQuery} from '@/features/atproto/data/useAtmosphereFeedQuery'
import {useAtprotoCapability} from '@/features/atproto/data/useApiMetadataQuery'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AtmospherePreviewSection() {
  const {colours, radius, spacing} = useThemeTokens()
  const importEnabled = useAtprotoCapability('atprotoImport')
  const feedQuery = useAtmosphereFeedQuery('modula-network')

  if (!importEnabled) {
    return null
  }

  return (
    <View style={{gap: spacing[3]}}>
      <View style={{gap: spacing[1]}}>
        <AppText variant="headline">{ATMOSPHERE_PREVIEW_LABEL}</AppText>
        <AppText variant="caption" colour="textSecondary">
          Selected imported AT profiles, public posts, and experimental Modula records. Not mixed
          into Home.
        </AppText>
      </View>

      {feedQuery.isPending ? <InitialLoadingState label="Loading external network preview" /> : null}
      {feedQuery.isError ? (
        <QueryErrorState
          title="External network preview unavailable"
          error={feedQuery.error}
          onRetry={() => void feedQuery.refetch()}
        />
      ) : null}

      {feedQuery.data ? (
        feedQuery.data.items.length === 0 ? (
          <EmptyState
            title="No external network items yet"
            description="Optional bridged public content will appear here when connected."
          />
        ) : (
          <View style={{gap: spacing[2]}}>
            {feedQuery.data.items.map(item => (
              <Surface
                key={item.id}
                variant="plain"
                style={[
                  styles.item,
                  {
                    borderRadius: radius.md,
                    padding: spacing[3],
                    gap: spacing[2],
                    borderColor: colours.border,
                  },
                ]}>
                <OriginLabel origin={item.origin} />
                {item.handle ? (
                  <AppText variant="label">@{item.handle}</AppText>
                ) : null}
                {item.text ? (
                  <AppText variant="body" colour="textSecondary">
                    {item.text}
                  </AppText>
                ) : (
                  <AppText variant="caption" colour="textMuted">
                    {item.collection ?? 'AT Protocol record'}
                  </AppText>
                )}
              </Surface>
            ))}
          </View>
        )
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  item: {
    borderWidth: StyleSheet.hairlineWidth,
  },
})
