import {View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

type AppEmptyStateProps = {
  title: string
  message?: string
}

export function AppEmptyState({title, message}: AppEmptyStateProps) {
  const {spacing} = useTheme()
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.sm,
      }}>
      <AppText variant="title" style={{textAlign: 'center'}}>
        {title}
      </AppText>
      {message ? (
        <AppText colour="textSecondary" style={{textAlign: 'center'}}>
          {message}
        </AppText>
      ) : null}
    </View>
  )
}
