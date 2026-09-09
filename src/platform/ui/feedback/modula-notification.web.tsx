import {KonstaNotification} from '@/platform/ui/adapters/konsta/notification.web'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import type {ModulaNotificationProps} from '@/platform/ui/feedback/modula-notification'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaNotification({
  action,
  description,
  icon,
  onDismiss,
  testID,
  timestamp,
  title,
}: ModulaNotificationProps) {
  const {colours} = useThemeTokens()
  return (
    <div aria-live="polite" data-testid={testID} role="status">
      <KonstaNotification
        action={action ? <ModulaButton label={action.label} onPress={action.onPress} role="inline" /> : undefined}
        description={description}
        dismiss={onDismiss ? <ModulaButton accessibilityLabel="Dismiss notification" label="×" onPress={onDismiss} role="plain" /> : undefined}
        icon={icon ? <ModulaIcon colour={colours.accent} name={icon} size={20} /> : undefined}
        timestamp={timestamp}
        title={title}
      />
    </div>
  )
}
