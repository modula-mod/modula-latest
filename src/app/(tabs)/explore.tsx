import {StyleSheet, View} from 'react-native'

import {AppAvatar} from '@/components/primitives/AppAvatar'
import {AppChip} from '@/components/primitives/AppChip'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppSearchField} from '@/components/primitives/AppSearchField'
import {AppText} from '@/components/primitives/AppText'
import {
  MOCK_SUGGESTED_ACCOUNTS,
  MOCK_TOPICS,
} from '@/social/adapters'
import {ScreenHeader} from '@/shell/ScreenHeader'
import {stubAction} from '@/lib/stubAction'
import {useTheme} from '@/theme/runtime/useTheme'

export default function ExploreScreen() {
  const {colours, spacing} = useTheme()

  return (
    <AppScreen padded={false}>
      <ScreenHeader title="Explore" />
      <AppScreen scroll>
        <AppSearchField
          placeholder="Search topics and people"
          editable={false}
          onPressIn={() => stubAction('Search')}
          containerStyle={{marginBottom: spacing.xl}}
        />

        <AppText variant="label" style={{marginBottom: spacing.md}}>
          Topics
        </AppText>
        <View style={[styles.chips, {marginBottom: spacing.xl, gap: spacing.sm}]}>
          {MOCK_TOPICS.map(topic => (
            <AppChip
              key={topic.id}
              label={topic.label}
              onPress={() => stubAction(`Topic: ${topic.label}`)}
            />
          ))}
        </View>

        <AppText variant="label" style={{marginBottom: spacing.md}}>
          Suggested accounts
        </AppText>
        {MOCK_SUGGESTED_ACCOUNTS.map(account => (
          <View
            key={account.id}
            style={[
              styles.account,
              {
                borderBottomColor: colours.border,
                paddingVertical: spacing.md,
                gap: spacing.md,
              },
            ]}>
            <AppAvatar name={account.displayName} size={40} />
            <View style={{flex: 1}}>
              <AppText variant="label">{account.displayName}</AppText>
              <AppText variant="caption" colour="textSecondary">
                @{account.handle}
              </AppText>
            </View>
          </View>
        ))}
      </AppScreen>
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
