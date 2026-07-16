import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Pill} from '@/components/primitives/Pill'
import {Surface} from '@/components/primitives/Surface'
import {useDemoSocial} from '@/demo/DemoSocialContext'
import {currentDemoProfile} from '@/demo/demoProfiles'
import {demoModules} from '@/demo/demoModules'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileTab = 'Posts' | 'Media' | 'Modules'

export function ProfileScreen() {
  const {posts} = useDemoSocial()
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [tab, setTab] = useState<ProfileTab>('Posts')
  const ownPosts = useMemo(
    () => posts.filter(post => post.author.id === currentDemoProfile.id),
    [posts],
  )
  const mediaPosts = ownPosts.filter(post => post.kind === 'media')

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={{paddingBottom: 96}}
          keyboardShouldPersistTaps="handled">
          <View
            style={[
              styles.cover,
              {
                backgroundColor: colours.accentSubtle,
                borderBottomColor: colours.border,
              },
            ]}>
            <View
              style={[
                styles.coverGlow,
                {
                  backgroundColor: currentDemoProfile.avatarColour,
                  borderRadius: radius.xlarge,
                },
              ]}
            />
          </View>
          <View style={[styles.profileBlock, {gap: spacing[4], padding: spacing[4]}]}>
            <Avatar
              name={currentDemoProfile.displayName}
              colour={currentDemoProfile.avatarColour}
              size={84}
              style={[
                styles.profileAvatar,
                {borderColor: colours.canvas, backgroundColor: colours.accent},
              ]}
            />
            <View style={styles.profileTop}>
              <View style={styles.identity}>
                <AppText variant="display">{currentDemoProfile.displayName}</AppText>
                <AppText variant="body" colour="textSecondary">
                  @{currentDemoProfile.handle}
                </AppText>
              </View>
              <AppPressable
                accessibilityLabel="Edit profile"
                style={[
                  styles.editButton,
                  {
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                    borderRadius: radius.round,
                  },
                ]}>
                <AppText variant="label">Edit profile</AppText>
              </AppPressable>
            </View>
            <AppText variant="body">{currentDemoProfile.bio}</AppText>
            <View style={[styles.indicators, {gap: spacing[2]}]}>
              {['Profile OS', 'Local demo', 'Modules ready'].map(item => (
                <Pill key={item} label={item} />
              ))}
            </View>
            <View style={styles.counts}>
              {[
                ['Following', currentDemoProfile.followingCount],
                ['Followers', currentDemoProfile.followerCount],
                ['Modules', currentDemoProfile.moduleCount],
              ].map(([label, value]) => (
                <View key={label} style={styles.count}>
                  <AppText variant="headline">{value}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {label}
                  </AppText>
                </View>
              ))}
            </View>
            <View style={[styles.profileActions, {gap: spacing[2]}]}>
              <AppPressable
                accessibilityLabel="Open Board"
                onPress={() => router.push('/board' as Href)}
                style={[
                  styles.profileAction,
                  {backgroundColor: colours.accent, borderRadius: radius.round},
                ]}>
                <AppIcon name="board" colour={colours.accentForeground} />
                <AppText variant="label" style={{color: colours.accentForeground}}>
                  Board
                </AppText>
              </AppPressable>
              <AppPressable
                accessibilityLabel="Open modules"
                onPress={() => router.push('/modules' as Href)}
                style={[
                  styles.profileAction,
                  {
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                    borderRadius: radius.round,
                  },
                ]}>
                <AppIcon name="modules" colour={colours.textSecondary} />
                <AppText variant="label">Modules</AppText>
              </AppPressable>
            </View>
          </View>
          <View style={[styles.tabs, {borderBottomColor: colours.border}]}>
            {(['Posts', 'Media', 'Modules'] as const).map(item => (
              <AppPressable
                key={item}
                accessibilityLabel={`${item} tab`}
                accessibilityState={{selected: tab === item}}
                onPress={() => setTab(item)}
                style={styles.tab}>
                <AppText
                  variant="label"
                  style={{color: tab === item ? colours.accent : colours.textSecondary}}>
                  {item}
                </AppText>
                <View
                  style={[
                    styles.tabLine,
                    {backgroundColor: tab === item ? colours.accent : 'transparent'},
                  ]}
                />
              </AppPressable>
            ))}
          </View>
          <View style={[styles.tabContent, {padding: spacing[4]}]}>
            {tab === 'Posts' ? (
              ownPosts.length ? (
                <View style={{gap: spacing[3]}}>
                  {ownPosts.map(post => (
                    <Surface
                      key={post.id}
                      variant="plain"
                      style={[styles.profilePost, {borderBottomColor: colours.border}]}>
                      <AppText variant="caption" colour="textSecondary">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </AppText>
                      <AppText variant="body">
                        {'text' in post && post.text
                          ? post.text
                          : post.kind === 'media'
                            ? post.text ?? 'Shared local media'
                            : 'Shared a Modula surface'}
                      </AppText>
                    </Surface>
                  ))}
                </View>
              ) : (
                <EmptyState
                  icon="profile"
                  title="No profile posts"
                  description="Publish a local post from the composer to populate your profile."
                />
              )
            ) : null}
            {tab === 'Media' ? (
              mediaPosts.length ? (
                <View style={[styles.mediaGrid, {gap: spacing[2]}]}>
                  {mediaPosts.map(post => (
                    <View
                      key={post.id}
                      style={[
                        styles.mediaTile,
                        {
                          backgroundColor:
                            post.kind === 'media'
                              ? post.media[0]?.colour
                              : colours.surfaceMuted,
                          borderRadius: radius.medium,
                        },
                      ]}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState
                  icon="photo"
                  title="No profile media yet"
                  description="Selected local photos will appear here after you publish them."
                />
              )
            ) : null}
            {tab === 'Modules' ? (
              <View style={{gap: spacing[3]}}>
                {demoModules.slice(0, 4).map(module => (
                  <Surface
                    key={module.id}
                    variant="contained"
                    style={[styles.moduleRow, {gap: spacing[3], padding: spacing[3]}]}>
                    <AppIcon name={module.icon} colour={colours.accent} />
                    <View style={styles.moduleBody}>
                      <AppText variant="label">{module.name}</AppText>
                      <AppText variant="caption" colour="textSecondary">
                        {module.description}
                      </AppText>
                    </View>
                    <AppText variant="caption" colour="accent">
                      {module.status}
                    </AppText>
                  </Surface>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  count: {
    flex: 1,
  },
  counts: {
    flexDirection: 'row',
  },
  cover: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 150,
    overflow: 'hidden',
  },
  coverGlow: {
    height: 170,
    opacity: 0.18,
    position: 'absolute',
    right: -60,
    top: 32,
    width: 220,
  },
  editButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  indicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mediaTile: {
    aspectRatio: 1,
    flexBasis: '31.5%',
  },
  moduleBody: {
    flex: 1,
    minWidth: 0,
  },
  moduleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  profileAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  profileActions: {
    flexDirection: 'row',
  },
  profileAvatar: {
    borderWidth: 4,
    marginTop: -58,
  },
  profileBlock: {},
  profilePost: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingBottom: 12,
  },
  profileTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  screen: {
    flex: 1,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    minHeight: 46,
    justifyContent: 'center',
  },
  tabContent: {},
  tabLine: {
    height: 2,
    width: '100%',
  },
  tabs: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
