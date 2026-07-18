import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {seededCommunities} from '@/features/social/data/seededSurfaces'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function CommunitiesOsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Communities" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Groups inside Profile-OS.</AppText>
            <AppText variant="body" colour="textSecondary">
              Communities, forums, and membership spaces attach to profiles and Teams — seeded
              Preview below.
            </AppText>
          </View>

          {seededCommunities.map(community => (
            <Surface
              key={community.id}
              variant="contained"
              style={[
                styles.card,
                {
                  padding: spacing[4],
                  gap: spacing[2],
                  borderRadius: radius.large,
                  backgroundColor: colours.surface,
                  borderColor: colours.border,
                },
              ]}>
              <View style={[styles.row, {gap: spacing[2]}]}>
                <AppIcon name="community" colour={colours.accent} />
                <AppText variant="headline">{community.name}</AppText>
              </View>
              <AppText variant="body" colour="textSecondary">
                {community.description}
              </AppText>
              <AppText variant="caption" colour="textTertiary">
                {community.membersLabel} · {community.topic}
              </AppText>
              <AppButton
                variant="secondary"
                onPress={() => router.push(`/communities/${community.id}` as Href)}>
                Open
              </AppButton>
            </Surface>
          ))}

          <AppButton onPress={() => router.push('/marketplace/module-communities' as Href)}>
            Communities module card
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product' as Href)}>
            Product Hub
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  row: {alignItems: 'center', flexDirection: 'row'},
})
