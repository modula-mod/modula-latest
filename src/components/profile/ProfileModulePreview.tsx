import {StyleSheet, View} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileModulePreviewProps = {
  icon: AppIconName
  name: string
  description: string
  status: string
}

export function ProfileModulePreview({
  icon,
  name,
  description,
  status,
}: ProfileModulePreviewProps) {
  const {colours, spacing} = useThemeTokens()
  return (
    <MaterialSurface role="card" style={[styles.wrap, {gap: spacing[3], padding: spacing[3]}]}>
      <AppIcon name={icon} colour={colours.accent} />
      <View style={styles.body}>
        <AppText variant="label">{name}</AppText>
        <AppText variant="caption" colour="textSub">
          {description}
        </AppText>
      </View>
      <AppText variant="caption" colour="accent">
        {status}
      </AppText>
    </MaterialSurface>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minWidth: 0,
  },
  wrap: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
