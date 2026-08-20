import {Pressable, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppText} from '@/components/primitives/AppText'
import {SkeletonBlock} from '@/platform/ui/skeletons'
import type {ProfileLink, ProfileViewerContext} from '@/features/profile/contracts/profile'
import {openSafeExternalUrl} from '@/lib/safeExternalUrl'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileLinksPreviewProps = {
  links: ProfileLink[]
  viewer: ProfileViewerContext
  loading?: boolean
  displayName: string
  onViewAll: () => void
}

/**
 * Compact snapshot of public profile links. The lower Links tab remains
 * the full collection. Preview slices featured entries only.
 */
export function ProfileLinksPreview({
  links,
  viewer,
  loading,
  displayName,
  onViewAll,
}: ProfileLinksPreviewProps) {
  const {colours, spacing} = useThemeTokens()
  const first = displayName.split(' ')[0] ?? displayName

  if (loading) {
    return (
      <View style={[styles.host, {gap: spacing[2]}]} testID="profile-links-preview">
        <SkeletonBlock height={12} width="54%" />
        <SkeletonBlock height={28} width="88%" />
        <SkeletonBlock height={28} width="72%" />
      </View>
    )
  }

  if (!links.length) {
    return (
      <View style={[styles.host, {gap: spacing[2]}]} testID="profile-links-preview">
        <AppText variant="body" colour="textSecondary">
          {viewer.relationship === 'owner' ? 'Add links to your profile.' : 'No public links.'}
        </AppText>
        {viewer.relationship === 'owner' ? (
          <OwnerEditCta />
        ) : null}
      </View>
    )
  }

  return (
    <View style={[styles.host, {gap: spacing[2]}]} testID="profile-links-preview">
      <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
        Links shared by {first}
      </AppText>
      {links.map(link => (
        <Pressable
          key={link.id}
          accessibilityRole="link"
          accessibilityLabel={`${link.label}, ${link.domain}`}
          testID={`profile-link-preview-${link.id}`}
          hitSlop={6}
          onPress={() => void openSafeExternalUrl(link.url)}
          style={styles.row}>
          <View style={styles.copy}>
            <AppText variant="label" numberOfLines={1}>
              {link.label}
            </AppText>
            <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
              {link.domain}
            </AppText>
          </View>
          <ModulaIcon name="share" colour={colours.textTertiary} size={12} />
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View all links"
        testID="profile-snapshot-cta-links"
        hitSlop={8}
        onPress={onViewAll}
        style={styles.cta}>
        <AppText variant="label" colour="accent" numberOfLines={1}>
          View all links
        </AppText>
        <ModulaIcon name="chevronRight" colour={colours.accent} size={12} />
      </Pressable>
    </View>
  )
}

function OwnerEditCta() {
  const router = useRouter()
  const {colours} = useThemeTokens()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Edit profile"
      hitSlop={8}
      onPress={() => router.push('/profile/edit' as Href)}
      style={styles.cta}>
      <AppText variant="label" colour="accent">
        Edit profile
      </AppText>
      <ModulaIcon name="chevronRight" colour={colours.accent} size={12} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  cta: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 32,
  },
  host: {
    minWidth: 0,
    width: '100%',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 36,
    minWidth: 0,
  },
})
