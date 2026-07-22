import type {ReactNode} from 'react'
import {Component} from 'react'
import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type BoundaryState = {failed: boolean}

export class ModuleErrorBoundary extends Component<{children: ReactNode; fallback?: ReactNode}, BoundaryState> {
  state: BoundaryState = {failed: false}

  static getDerivedStateFromError(): BoundaryState {
    return {failed: true}
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? <ModuleErrorState title="Module failed to load" />
    return this.props.children
  }
}

export function ModuleErrorState({
  title,
  body = 'This module is unavailable. The rest of Modula is still available.',
  onRetry,
  onOpenSettings,
}: {
  title: string
  body?: string
  onRetry?: () => void
  onOpenSettings?: () => void
}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3], padding: spacing[4]}}>
      <AppText variant="headline">{title}</AppText>
      <AppText variant="body" colour="textSecondary">
        {body}
      </AppText>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2]}}>
        {onRetry ? <ModulaButton label="Retry" accessibilityLabel="Retry" onPress={onRetry} /> : null}
        {onOpenSettings ? (
          <ModulaButton
            label="Open settings"
            role="secondary"
            accessibilityLabel="Open module settings"
            onPress={onOpenSettings}
          />
        ) : null}
      </View>
    </View>
  )
}
