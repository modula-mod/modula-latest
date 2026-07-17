import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {
  friendlyPublicationMessage,
  labelForUiPublicationStatus,
  type UiPublicationStatus,
} from '@/features/atproto/publishing/publicationStatus'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PublicationStatusBannerProps = {
  status: UiPublicationStatus
  onRetry?: () => void
  onKeepModulaOnly?: () => void
}

export function PublicationStatusBanner({
  status,
  onRetry,
  onKeepModulaOnly,
}: PublicationStatusBannerProps) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const showActions =
    status === 'needsAttention' || status === 'connectionExpired' || status === 'publishingToAtproto'

  return (
    <Surface
      variant="muted"
      style={[
        styles.wrap,
        {
          borderRadius: radius.md,
          padding: spacing[3],
          gap: spacing[2],
          borderColor: colours.border,
        },
      ]}>
      <AppText variant="label">{labelForUiPublicationStatus(status)}</AppText>
      <AppText variant="caption" colour="textSecondary">
        {friendlyPublicationMessage(status)}
      </AppText>
      {showActions ? (
        <View style={[styles.actions, {gap: spacing[3]}]}>
          {onRetry ? (
            <AppPressable accessibilityLabel="Retry AT publishing" onPress={onRetry}>
              <AppText variant="label" style={{color: colours.accent}}>
                Retry
              </AppText>
            </AppPressable>
          ) : null}
          <AppPressable
            accessibilityLabel="Reconnect AT Protocol"
            onPress={() => router.push('/settings/connections/atproto' as Href)}>
            <AppText variant="label" style={{color: colours.accent}}>
              Reconnect
            </AppText>
          </AppPressable>
          {onKeepModulaOnly ? (
            <AppPressable accessibilityLabel="Keep Modula only" onPress={onKeepModulaOnly}>
              <AppText variant="label" style={{color: colours.accent}}>
                Keep Modula only
              </AppText>
            </AppPressable>
          ) : null}
        </View>
      ) : null}
    </Surface>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
