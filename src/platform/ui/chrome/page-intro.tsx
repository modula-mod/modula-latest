import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Editorial page intro. Use when the screen header does not already own
 * the same title. Eyebrow + body can stand alone under a native title.
 *
 * Reference: Developer Tools density (caption / display / body) without
 * the studio gradient card.
 */
export function PageIntro({
  eyebrow,
  title,
  body,
  icon,
}: {
  eyebrow?: string
  title?: string
  body?: string
  icon?: ModulaIconName
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.wrap, {gap: spacing[2]}]}>
      {eyebrow || icon ? (
        <View style={[styles.eyebrow, {gap: spacing[2]}]}>
          {icon ? <ModulaIcon name={icon} size={16} colour={colours.textTertiary} /> : null}
          {eyebrow ? (
            <AppText variant="micro" colour="textTertiary">
              {eyebrow.toUpperCase()}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {title ? <AppText variant="display">{title}</AppText> : null}
      {body ? (
        <AppText variant="body" colour="textSecondary">
          {body}
        </AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  eyebrow: {alignItems: 'center', flexDirection: 'row'},
  wrap: {width: '100%'},
})
