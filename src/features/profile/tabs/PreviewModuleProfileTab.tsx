import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import type {
  ProfileTabManifest,
  ProfileTabRendererProps,
} from '@/features/profile/contracts/profileTabs'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const PREVIEW_COPY: Record<
  string,
  {
    icon: Parameters<typeof AppIcon>[0]['name']
    title: string
    body: string
    primaryLabel: string
    primaryRoute: Href
    secondaryLabel: string
    secondaryRoute: Href
  }
> = {
  shop: {
    icon: 'marketplace',
    title: 'Shop tab · Preview',
    body:
      'This public slot will hold products, services, downloads, or entitlements that a profile chooses to publish. Checkout, ownership proofs, and NFT-backed access are not active here; the inactive NFT Studio only explains the reserved ownership direction.',
    primaryLabel: 'Open NFT Studio (inactive)',
    primaryRoute: '/product/nft' as Href,
    secondaryLabel: 'Browse Marketplace',
    secondaryRoute: '/marketplace' as Href,
  },
  agents: {
    icon: 'automation',
    title: 'Agents tab · Preview',
    body:
      'This owner-only slot will show scoped assistants that can help with summaries, scheduling, research, and CRM workflows after packages register through the module system. Agents stay governed by explicit scopes, and the Intelligence Hub explains the GAIA, AKI, and Governor model.',
    primaryLabel: 'Open Intelligence Hub',
    primaryRoute: '/product/intelligence' as Href,
    secondaryLabel: 'Open Agents studio',
    secondaryRoute: '/product/agents' as Href,
  },
}

function getPreviewCopy(tab: ProfileTabManifest): (typeof PREVIEW_COPY)[string] {
  return PREVIEW_COPY[tab.id] ?? {
    icon: 'modules',
    title: 'Module tab · Preview',
    body:
      'This tab slot is reserved for an installable module on this Profile-OS. External packages register real content through Greenfield manifests, so the host stays clear about what is present now and what is still Preview.',
    primaryLabel: 'Open Forge Builder',
    primaryRoute: '/product/forge' as Href,
    secondaryLabel: 'Modules library',
    secondaryRoute: '/modules' as Href,
  }
}

/**
 * Shared Preview renderer for optional module-contributed profile tabs
 * (Shop, Agents, …) until external packages register real renderers.
 */
export function PreviewModuleProfileTab({profile, tab}: ProfileTabRendererProps) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const copy = getPreviewCopy(tab)

  return (
    <ScrollView contentContainerStyle={[styles.content, {gap: spacing[4], padding: spacing[4]}]}>
      <Surface
        variant="contained"
        style={[
          styles.card,
          {
            padding: spacing[4],
            gap: spacing[3],
            borderRadius: radius.large,
            backgroundColor: colours.surface,
            borderColor: colours.border,
          },
        ]}>
        <AppIcon name={copy.icon} colour={colours.accent} />
        <AppText variant="headline">{copy.title}</AppText>
        <AppText variant="body" colour="textSecondary">
          {copy.body}
        </AppText>
        <AppText variant="caption" colour="textSecondary">
          The slot belongs to {profile.displayName}’s Profile-OS, but it does not claim a live module
          install until Registry supplies the package.
        </AppText>
        <AppButton onPress={() => router.push(copy.primaryRoute)}>{copy.primaryLabel}</AppButton>
        <AppButton variant="secondary" onPress={() => router.push(copy.secondaryRoute)}>
          {copy.secondaryLabel}
        </AppButton>
        <AppButton variant="ghost" onPress={() => router.push('/profile/customize' as Href)}>
          Customize tabs
        </AppButton>
      </Surface>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {paddingBottom: 40},
  card: {borderWidth: StyleSheet.hairlineWidth},
})
