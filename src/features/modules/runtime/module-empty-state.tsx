import {View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleEmptyState({title, body}: {title: string; body?: string}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <Surface
      variant="contained"
      style={{
        alignItems: 'center',
        borderColor: colours.border,
        borderRadius: radius.large,
        gap: spacing[2],
        padding: spacing[5],
      }}>
      <View style={{backgroundColor: colours.accentSubtle, borderRadius: radius.round, padding: spacing[3]}}>
        <AppIcon name="modules" colour={colours.accent} />
      </View>
      <AppText variant="headline">{title}</AppText>
      {body ? (
        <AppText variant="caption" colour="textSecondary" style={{textAlign: 'center'}}>
          {body}
        </AppText>
      ) : null}
    </Surface>
  )
}
