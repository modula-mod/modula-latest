import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaIcon} from '@/platform/ui/icons'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaNotificationProps = {
  icon?: ModulaIconName
  title: string
  description: string
  timestamp?: string
  action?: {label: string; onPress: () => void}
  onDismiss?: () => void
  testID?: string
}

export function ModulaNotification({
  action,
  description,
  icon,
  onDismiss,
  testID,
  timestamp,
  title,
}: ModulaNotificationProps) {
  const {colours, spacing} = useThemeTokens()
  return (
    <Surface variant="platform" role="floating" style={{padding: spacing[4]}}>
      <View accessibilityLiveRegion="polite" style={{flexDirection: 'row', gap: spacing[3]}} testID={testID}>
        {icon ? <ModulaIcon colour={colours.accent} name={icon} size={20} /> : null}
        <View style={{flex: 1, gap: spacing[1]}}>
          <AppText variant="headline">{title}</AppText>
          {timestamp ? <AppText colour="textSecondary" variant="metadata">{timestamp}</AppText> : null}
          <AppText colour="textSecondary" variant="caption">{description}</AppText>
          {action ? <ModulaButton label={action.label} onPress={action.onPress} role="inline" /> : null}
        </View>
        {onDismiss ? <ModulaButton accessibilityLabel="Dismiss notification" label="×" onPress={onDismiss} role="plain" /> : null}
      </View>
    </Surface>
  )
}
