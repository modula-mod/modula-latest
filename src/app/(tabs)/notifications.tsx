import {View} from 'react-native'

import {AppAvatar} from '@/components/primitives/AppAvatar'
import {AppEmptyState} from '@/components/primitives/AppEmptyState'
import {AppList} from '@/components/primitives/AppList'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {MOCK_NOTIFICATIONS} from '@/social/adapters'
import {ScreenHeader} from '@/shell/ScreenHeader'
import {useTheme} from '@/theme/runtime/useTheme'

export default function NotificationsScreen() {
  const {colours, spacing} = useTheme()

  if (MOCK_NOTIFICATIONS.length === 0) {
    return (
      <AppScreen padded={false}>
        <ScreenHeader title="Notifications" />
        <AppEmptyState
          title="You are all caught up"
          message="Notification delivery arrives with the real social provider."
        />
      </AppScreen>
    )
  }

  return (
    <AppScreen padded={false}>
      <ScreenHeader title="Notifications" />
      <AppList
        data={MOCK_NOTIFICATIONS}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderBottomWidth: StyleSheetHairline,
              borderBottomColor: colours.border,
            }}>
            <AppAvatar name={item.actor.displayName} size={40} />
            <View style={{flex: 1, gap: 4}}>
              <AppText>
                <AppText variant="label">{item.actor.displayName}</AppText>
                {' '}
                {item.text}
              </AppText>
              <AppText variant="caption" colour="textSecondary">
                {item.createdAtLabel}
              </AppText>
            </View>
          </View>
        )}
      />
    </AppScreen>
  )
}

const StyleSheetHairline = 1
