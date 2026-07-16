import {ScrollView, StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
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
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.wrap, {borderBottomColor: colours.separator}]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.content, {gap: spacing[2], paddingHorizontal: spacing[4]}]}>
        {tabs.map(tab => {
          const selected = tab.id === selectedTabId
          return (
            <AppPressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityLabel={tab.accessibilityLabel}
              accessibilityState={{selected}}
              onPress={() => onSelectTab(tab.id)}
              style={[
                styles.tab,
                {
                  backgroundColor: selected ? colours.accentSubtle : 'transparent',
                  borderColor: selected ? colours.accentBorder : 'transparent',
                  borderRadius: radius.round,
                  gap: spacing[2],
                  paddingHorizontal: spacing[3],
                },
              ]}>
              <AppIcon
                name={tab.icon}
                colour={selected ? colours.accent : colours.textSecondary}
                size={18}
              />
              <AppText
                variant="label"
                style={{color: selected ? colours.accent : colours.textSecondary}}>
                {tab.title}
              </AppText>
            </AppPressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 10,
  },
  tab: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
