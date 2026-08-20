import {StyleSheet, View} from 'react-native'

import type {ProfileTabRendererProps} from '@/features/profile/contracts/profileTabs'
import {ProfileLinkCard} from '@/features/profile/components/ProfileLinkCard'
import {ProfileTabEmptyState} from '@/features/profile/components/ProfileTabEmptyState'
import {resolvePublicProfileLinks} from '@/features/profile/data/resolveProfilePublicContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function LinksProfileTab({profile, viewer}: ProfileTabRendererProps) {
  const {spacing} = useThemeTokens()
  const links = resolvePublicProfileLinks(profile, viewer.relationship)

  if (!links.length) {
    return (
      <ProfileTabEmptyState
        icon="link"
        title={
          viewer.relationship === 'owner'
            ? 'Add links to make your profile more useful.'
            : 'No public links are available.'
        }
        description="Public links can point to websites, portfolios, updates, shops or newsletters."
      />
    )
  }

  return (
    <View style={[styles.wrap, {gap: spacing[3], padding: spacing[4]}]}>
      {links.map(link => (
        <ProfileLinkCard key={link.id} link={link} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 0,
  },
})
