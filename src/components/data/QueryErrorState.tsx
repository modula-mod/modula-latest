import {useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {getUserFacingErrorMessage, isModulaApiError} from '@/api/contracts'
import {AppButton} from '@/components/primitives/AppButton'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  classifyShellError,
  shellErrorTitle,
} from '@/components/data/classifyShellError'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function QueryErrorState({
  title,
  error,
  onRetry,
}: {
  title?: string
  error: unknown
  onRetry?: () => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const {spacing} = useThemeTokens()
  const kind = classifyShellError(error)
  const heading = title ?? shellErrorTitle(kind)
  const apiError = isModulaApiError(error) ? error : null

  return (
    <View
      accessibilityRole="alert"
      style={[styles.wrap, {gap: spacing[3], padding: spacing[4]}]}>
      <View style={{gap: spacing[1]}}>
        <AppText variant="headline">{heading}</AppText>
        <AppText variant="body" colour="textSecondary">
          {getUserFacingErrorMessage(error)}
        </AppText>
      </View>
      {onRetry ? <AppButton onPress={onRetry}>Retry</AppButton> : null}
      {__DEV__ && apiError ? (
        <View style={{gap: spacing[2]}}>
          <AppPressable
            accessibilityLabel="Toggle developer error details"
            onPress={() => setDetailsOpen(value => !value)}>
            <AppText variant="caption" colour="accent">
              Developer information
            </AppText>
          </AppPressable>
          {detailsOpen ? (
            <AppText variant="caption" colour="textSecondary">
              {`Code: ${apiError.code} · Status: ${apiError.status} · Request: ${apiError.requestId ?? 'n/a'} · Retryable: ${apiError.retryable ? 'yes' : 'no'}`}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
})
