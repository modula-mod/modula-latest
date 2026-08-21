import {useState} from 'react'
import {View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProductDescription({children}: {children: string}) {
  const {spacing} = useThemeTokens()
  const [expanded, setExpanded] = useState(false)
  const [canCollapse, setCanCollapse] = useState(false)
  return (
    <View style={{gap: spacing[2]}} testID="product-description">
      <AppText variant="sectionTitle" accessibilityRole="header">Description</AppText>
      <AppText
        variant="body"
        colour="textSecondary"
        numberOfLines={expanded ? undefined : 4}
        onTextLayout={event => {
          if (!expanded) setCanCollapse(event.nativeEvent.lines.length >= 4)
        }}
        selectable>
        {children}
      </AppText>
      {canCollapse ? (
        <AppPressable
          accessibilityLabel={expanded ? 'Show less description' : 'Show full description'}
          accessibilityState={{expanded}}
          onPress={() => setExpanded(current => !current)}>
          <AppText variant="caption" colour="accent">{expanded ? 'Less' : 'More'}</AppText>
        </AppPressable>
      ) : null}
    </View>
  )
}
