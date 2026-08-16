import {useEffect, useRef} from 'react'
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from 'react-native'

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
}

type ModulaMotionTabsProps = {
  tabs: ModulaMotionTab[]
  selectedTabId: string
  onSelectTab: (tabId: string) => void
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
}: ModulaMotionTabsProps) {
  const {colours, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const previous = useRef(selectedTabId)

  useEffect(() => {
    if (previous.current === selectedTabId) return
    previous.current = selectedTabId
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }
  }, [reduceMotion, selectedTabId])

  return (
    <View style={[styles.wrap, {borderBottomColor: colours.separator}]}>
      <ScrollView
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
              accessibilityState={{selected}}
              onPress={() => {
                void selectionHaptic()
                onSelectTab(tab.id)
              }}
              style={styles.tab}>
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
