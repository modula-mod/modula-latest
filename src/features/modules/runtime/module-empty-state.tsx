import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleEmptyState({
  title,
  body,
  message,
  primaryAction,
  secondaryAction,
}: {
  title: string
  body?: string
  message?: string
  primaryAction?: {label: string; onPress: () => void}
  secondaryAction?: {label: string; onPress: () => void}
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3], paddingVertical: spacing[6]}} testID="module-empty-state">
      <ModulaIcon name="modules" colour={colours.textTertiary} size={28} />
      <AppText variant="headline">{title}</AppText>
      {body || message ? (
        <AppText variant="body" colour="textSecondary">
          {body ?? message}
        </AppText>
      ) : null}
      {primaryAction ? (
        <ModulaButton
          label={primaryAction.label}
          accessibilityLabel={primaryAction.label}
          onPress={primaryAction.onPress}
        />
      ) : null}
      {secondaryAction ? (
        <ModulaButton
          label={secondaryAction.label}
          role="secondary"
          accessibilityLabel={secondaryAction.label}
          onPress={secondaryAction.onPress}
        />
      ) : null}
    </View>
  )
}
