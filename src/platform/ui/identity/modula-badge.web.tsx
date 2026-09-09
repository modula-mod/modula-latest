import {View} from 'react-native'

import {KonstaBadge} from '@/platform/ui/adapters/konsta/badge.web'
import {ModulaIcon} from '@/platform/ui/icons'
import type {ModulaBadgeProps} from '@/platform/ui/identity/modula-badge'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaBadge({label, tone = 'neutral', icon, style}: ModulaBadgeProps) {
  const {colours} = useThemeTokens()
  const colour =
    tone === 'accent' ? colours.accent
      : tone === 'success' ? colours.success
        : tone === 'warning' ? colours.warning
          : tone === 'danger' || tone === 'destructive' ? colours.destructive
            : tone === 'info' ? colours.info : colours.textSecondary
  return (
    <View style={style}>
      <KonstaBadge
        icon={icon ? <ModulaIcon name={icon} size={13} colour={colour} /> : undefined}
        label={label}
        tone={tone}
      />
    </View>
  )
}

export const ModulaStatusBadge = ModulaBadge
export const ModulaVerifiedBadge = ({label = 'Verified'}: {label?: string}) => (
  <ModulaBadge icon="check" label={label} tone="accent" />
)
export const ModulaBetaBadge = ({label = 'Beta'}: {label?: string}) => (
  <ModulaBadge label={label} tone="warning" />
)
export const ModulaCountBadge = ({count}: {count: number}) => (
  <ModulaBadge label={count > 99 ? '99+' : String(count)} tone="accent" />
)
