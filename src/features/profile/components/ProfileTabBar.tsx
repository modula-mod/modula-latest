import {ScrollView, StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ProfileTabManifest} from '@/features/profile/contracts/profileTabs'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileTabBarProps = {
  tabs: ProfileTabManifest[]
  selectedTabId: string
  onSelectTab: (tabId: string) => void
}

export function ProfileTabBar({
  tabs,
  selectedTabId,
  onSelectTab,
}: ProfileTabBarProps) {
  const {colours, spacing} = useThemeTokens()

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
              accessibilityLabel={
                tab.id === 'modules'
                  ? 'Select Modules profile tab'
                  : tab.accessibilityLabel
              }
              accessibilityState={{selected}}
              onPress={() => onSelectTab(tab.id)}
              style={styles.tab}>
              <AppText
                variant="label"
                style={{color: selected ? colours.text : colours.textSecondary}}>
                {tab.title}
              </AppText>
              <View
                style={[
                  styles.underline,
                  {backgroundColor: selected ? colours.accent : 'transparent'},
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
    width: '100%',
  },
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
