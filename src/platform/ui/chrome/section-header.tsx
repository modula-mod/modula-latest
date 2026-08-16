import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function SectionHeader({
  title,
  subtitle,
  icon,
  onPress,
  eyebrow,
  trailing,
}: {
  title: string
  subtitle?: string
  icon?: ModulaIconName
  onPress?: () => void
  eyebrow?: boolean
  trailing?: string
}) {
  const {colours, spacing} = useThemeTokens()
  const inner = (
    <View style={[styles.row, {gap: spacing[2]}]}>
      {icon ? <ModulaIcon name={icon} size={18} colour={colours.textTertiary} /> : null}
      <View style={styles.flex}>
        <AppText variant={eyebrow ? 'micro' : 'headline'} colour={eyebrow ? 'textTertiary' : 'text'}>
          {eyebrow ? title.toUpperCase() : title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" colour="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? (
        <AppText variant="caption" colour="textSecondary">
          {trailing}
        </AppText>
      ) : null}
      {onPress ? <ModulaIcon name="chevronRight" size={16} colour={colours.textTertiary} /> : null}
    </View>
  )
  if (!onPress) return inner
  return (
    <AppPressable accessibilityLabel={title} onPress={onPress}>
      {inner}
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  flex: {flex: 1, gap: 2, minWidth: 0},
  row: {alignItems: 'center', flexDirection: 'row', minHeight: 28},
})
