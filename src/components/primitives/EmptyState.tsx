import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type EmptyStateProps = {
  icon?: AppIconName
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({icon, title, description, action}: EmptyStateProps) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.wrap, {gap: spacing[3], padding: spacing[6]}]}>
      {icon ? (
        <AppIcon name={icon} colour={colours.textTertiary} size={28} />
      ) : null}
      <View style={{gap: spacing[1]}}>
        <AppText variant="headline" style={styles.center}>
          {title}
        </AppText>
        <AppText variant="body" colour="textSecondary" style={styles.center}>
          {description}
        </AppText>
      </View>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
