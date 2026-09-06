import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaEmptyState as SharedEmptyState} from '@/platform/ui/feedback'

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
  return (
    <SharedEmptyState
      description={body ?? message ?? 'No module content yet.'}
      icon="modules"
      primaryAction={primaryAction ? (
        <ModulaButton
          label={primaryAction.label}
          accessibilityLabel={primaryAction.label}
          onPress={primaryAction.onPress}
        />
      ) : undefined}
      secondaryAction={secondaryAction ? (
        <ModulaButton
          label={secondaryAction.label}
          role="secondary"
          accessibilityLabel={secondaryAction.label}
          onPress={secondaryAction.onPress}
        />
      ) : undefined}
      title={title}
    />
  )
}
