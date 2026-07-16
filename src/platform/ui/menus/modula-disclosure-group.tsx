import type {ReactNode} from 'react'
import {useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ModulaDisclosureGroupProps = {
  label: string
  isExpanded?: boolean
  onIsExpandedChange?: (expanded: boolean) => void
  children: ReactNode
  rows?: string[]
}

/** Expandable section fallback for web / Android. */
export function ModulaDisclosureGroup({
  label,
  isExpanded: controlledExpanded,
  onIsExpandedChange,
  children,
  rows,
}: ModulaDisclosureGroupProps) {
  const {colours, spacing} = useThemeTokens()
  const [localExpanded, setLocalExpanded] = useState(false)
  const isExpanded = controlledExpanded ?? localExpanded
  const setExpanded = onIsExpandedChange ?? setLocalExpanded

  return (
    <View style={{gap: spacing[2]}}>
      <AppPressable
        accessibilityLabel={`${label}, ${isExpanded ? 'expanded' : 'collapsed'}`}
        accessibilityRole="button"
        onPress={() => setExpanded(!isExpanded)}
        style={[styles.header, {minHeight: 44}]}>
        <AppText variant="headline" style={{flex: 1}}>
          {label}
        </AppText>
        <AppIcon
          name={isExpanded ? 'arrowUp' : 'arrowDown'}
          colour={colours.textSecondary}
          size={18}
        />
      </AppPressable>
      {isExpanded ? (
        <View style={{gap: spacing[2], paddingLeft: spacing[1]}}>
          {rows?.map(row => (
            <AppText key={row} variant="body" colour="textSecondary">
              {row}
            </AppText>
          ))}
          {children}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
})
