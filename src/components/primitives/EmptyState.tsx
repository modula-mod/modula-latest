import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type EmptyStateProps = {
  icon?: ModulaIconName
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({icon, title, description, action}: EmptyStateProps) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.wrap, {gap: spacing[3], padding: spacing[6]}]}>
      {icon ? <ModulaIcon name={icon} colour={colours.textTertiary} size={28} /> : null}
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
