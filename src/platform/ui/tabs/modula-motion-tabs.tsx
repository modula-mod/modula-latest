import {useEffect, useRef} from 'react'
import {LayoutAnimation, Platform, ScrollView, StyleSheet, UIManager, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export type ModulaMotionTab = {
  id: string
  title: string
  accessibilityLabel?: string
  disabled?: boolean
}

type ModulaMotionTabsProps = {
  tabs: ModulaMotionTab[]
  selectedTabId: string
  onSelectTab: (tabId: string) => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Profile content-tab motion strip (Posts / Media / About / Modules / Links).
 *
 * Port of the *content-tab* UX intent from rit3zh/expo-motion-tabs — NOT the
 * bottom-tab morphing popup (rejected: fights liquid-glass primary tabs +
 * requires Reanimated for its demo). Uses LayoutAnimation + Pressable only.
 */
export function ModulaMotionTabs({
  tabs,
  selectedTabId,
  onSelectTab,
  accessibilityLabel,
  style,
  testID,
}: ModulaMotionTabsProps) {
  const {colours, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const previous = useRef(selectedTabId)
  const scroller = useRef<ScrollView>(null)
  const offsets = useRef<Record<string, number>>({})

  useEffect(() => {
    if (previous.current === selectedTabId) return
    previous.current = selectedTabId
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }
    const x = offsets.current[selectedTabId]
    if (typeof x === 'number') {
      scroller.current?.scrollTo({x: Math.max(0, x - 24), animated: !reduceMotion})
    }
  }, [reduceMotion, selectedTabId])

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={[styles.wrap, {borderBottomColor: colours.separator}, style]}
      testID={testID}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {gap: spacing[4], paddingHorizontal: spacing[4]},
        ]}>
        {tabs.map(tab => {
          const selected = tab.id === selectedTabId
          return (
            <AppPressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityLabel={tab.accessibilityLabel ?? tab.title}
              accessibilityState={{selected, disabled: tab.disabled}}
              disabled={tab.disabled}
              onLayout={event => {
                offsets.current[tab.id] = event.nativeEvent.layout.x
              }}
              onPress={() => {
                if (!tab.disabled) {
                  void selectionHaptic()
                  onSelectTab(tab.id)
                }
              }}
              style={[styles.tab, {opacity: tab.disabled ? 0.45 : 1}]}>
              <AppText
                variant="label"
                style={{
                  color: selected ? colours.text : colours.textSecondary,
                  fontWeight: selected ? '600' : '500',
                }}>
                {tab.title}
              </AppText>
              <View
                style={[
                  styles.underline,
                  {
                    backgroundColor: selected ? colours.text : 'transparent',
                    width: selected ? '100%' : '40%',
                  },
                ]}
              />
            </AppPressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
  },
  tab: {
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
  },
  underline: {
    height: 2,
  },
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
