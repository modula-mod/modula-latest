import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const OWNERSHIP_MEANINGS: Array<{
  title: string
  body: string
  icon: AppIconName
}> = [
  {
    title: 'Module entitlements',
    body: 'Proof that an account may access a module, tier, add-on, or private workspace.',
    icon: 'modules',
  },
  {
    title: 'Creator editions',
    body: 'Limited editions, membership proofs, and collector records without floor-price theatre.',
    icon: 'poll',
  },
  {
    title: 'Profile collectibles',
    body: 'Opt-in profile items and achievements that never gate professional use.',
    icon: 'profile',
  },
  {
    title: 'Team credentials',
    body: 'Role, certification, and organisation proofs that can be revoked by policy.',
    icon: 'teams',
  },
]

const PREVIEW_COLLECTIONS = [
  'Module Access Pass',
  'Creator Edition Proof',
  'Profile Collectible Badge',
  'Team Credential Proof',
] as const

const CREATOR_FLOW = [
  {step: 'Define collection', status: 'View only'},
  {step: 'Metadata', status: 'Blocked'},
  {step: 'AKI scan', status: 'Blocked'},
  {step: 'Governor policy', status: 'Blocked'},
  {step: 'Ledger', status: 'Blocked'},
  {step: 'DIMON settlement', status: 'Inactive'},
] as const

const LOCAL_ENTITLEMENTS = [
  'Vault Notes module entitlement - local Preview only',
  'Creator member tab access - local Preview only',
  'Team badge credential - local Preview only',
] as const

const LINKS: Array<{
  label: string
  detail: string
  href: Href
  icon: AppIconName
}> = [
  {
    label: 'DIMON status',
    detail: 'Required inactive ownership layer status.',
    href: '/settings/dimon',
    icon: 'security',
  },
  {
    label: 'Ledger & Replay',
    detail: 'Audit path preview without re-running side effects.',
    href: '/product/ledger',
    icon: 'storage',
  },
  {
    label: 'Ownership & Portability',
    detail: 'Export, permissions, sessions, and future purchase preservation.',
    href: '/product/ownership',
    icon: 'privacy',
  },
  {
    label: 'Marketplace',
    detail: 'Seeded module catalog. No billing or NFT trading.',
    href: '/marketplace',
    icon: 'marketplace',
  },
  {
    label: 'Developer Tools',
    detail: 'CLI, MCP, contracts, and command references.',
    href: '/product/developer',
    icon: 'developer',
  },
]

export function NftStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="NFT Studio" />
      <ResponsiveContent maxWidth={760}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <Surface
            variant="contained"
            style={[
              styles.hero,
              {
                padding: spacing[5],
                gap: spacing[3],
                borderRadius: radius.large,
                backgroundColor: colours.accentSubtle,
                borderColor: colours.accentBorder,
              },
            ]}>
            <AppText variant="caption" colour="accent">
              DIGITAL OWNERSHIP / PREVIEW STUBS / NO MINTING
            </AppText>
            <AppText variant="display">DIMON is not active yet</AppText>
            <AppText variant="body" colour="textSecondary">
              NFT Studio foreshadows ownership proofs for Modula. It is not a live mint
              marketplace, not a wallet, and not a speculative trading surface.
            </AppText>
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.medium,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="headline">Hard honesty boundary</AppText>
            <AppText variant="body" colour="textSecondary">
              No balances, funded-looking wallet addresses, floor prices, mint success states,
              transfer success states, settlement claims, or blockchain database claims are shown
              here.
            </AppText>
            <AppText variant="body" colour="textSecondary">
              ADR-006 says PostgreSQL is the primary application database. Blockchain is not the
              app database; future proofs would sit behind a reviewed DIMON service boundary.
            </AppText>
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">What NFTs mean in Modula</AppText>
            <View style={[styles.grid, {gap: spacing[3]}]}>
              {OWNERSHIP_MEANINGS.map(item => (
                <Surface
                  key={item.title}
                  variant="contained"
                  style={[
                    styles.gridCard,
                    {
                      padding: spacing[4],
                      gap: spacing[2],
                      borderRadius: radius.large,
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppIcon name={item.icon} colour={colours.accent} />
                  <AppText variant="headline">{item.title}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {item.body}
                  </AppText>
                </Surface>
              ))}
            </View>
          </View>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Collection gallery</AppText>
            <AppText variant="body" colour="textSecondary">
              Seeded Preview stubs. Names only. Status Reserved.
            </AppText>
            <View style={[styles.grid, {gap: spacing[3]}]}>
              {PREVIEW_COLLECTIONS.map(name => (
                <Surface
                  key={name}
                  variant="contained"
                  style={[
                    styles.gridCard,
                    {
                      padding: spacing[4],
                      gap: spacing[2],
                      borderRadius: radius.large,
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppText variant="caption" colour="accent">
                    Preview
                  </AppText>
                  <AppText variant="headline">{name}</AppText>
                  <AppText variant="caption" colour="textTertiary">
                    Status: Reserved
                  </AppText>
                </Surface>
              ))}
            </View>
          </View>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Creator flow Preview</AppText>
            {CREATOR_FLOW.map(item => (
              <Surface
                key={item.step}
                variant="contained"
                style={[
                  styles.row,
                  {
                    padding: spacing[4],
                    gap: spacing[3],
                    borderRadius: radius.medium,
                    backgroundColor: item.status === 'View only' ? colours.accentSubtle : colours.surface,
                    borderColor: item.status === 'View only' ? colours.accentBorder : colours.border,
                  },
                ]}>
                <AppIcon name="check" colour={colours.accent} size={18} />
                <View style={{flex: 1, gap: 2}}>
                  <AppText variant="label">{item.step}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {item.status === 'View only'
                      ? 'Inspectable local definition only.'
                      : 'Preview blocked until DIMON activation and policy review.'}
                  </AppText>
                </View>
                <AppText variant="caption" colour="accent">
                  {item.status}
                </AppText>
              </Surface>
            ))}
            <View style={[styles.actions, {gap: spacing[2]}]}>
              <AppButton disabled variant="secondary" style={styles.actionButton}>
                Preview blocked: mint request
              </AppButton>
              <AppButton disabled variant="secondary" style={styles.actionButton}>
                Preview blocked: transfer request
              </AppButton>
            </View>
          </View>

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
            <AppText variant="headline">Holder view Preview</AppText>
            <AppText variant="body" colour="textSecondary">
              Entitlements below are local-only examples. They are not balances and do not prove a
              live on-chain asset.
            </AppText>
            {LOCAL_ENTITLEMENTS.map(item => (
              <View key={item} style={[styles.noteRow, {gap: spacing[2]}]}>
                <AppIcon name="check" colour={colours.accent} size={16} />
                <AppText variant="caption" colour="textSecondary" style={{flex: 1}}>
                  {item}
                </AppText>
              </View>
            ))}
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Related surfaces</AppText>
            {LINKS.map(link => (
              <Surface
                key={link.href.toString()}
                variant="contained"
                style={[
                  styles.row,
                  {
                    padding: spacing[4],
                    gap: spacing[3],
                    borderRadius: radius.medium,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <AppIcon name={link.icon} colour={colours.accent} />
                <View style={{flex: 1, gap: 2}}>
                  <AppText variant="headline">{link.label}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {link.detail}
                  </AppText>
                </View>
                <AppButton variant="ghost" onPress={() => router.push(link.href)}>
                  Open
                </AppButton>
              </Surface>
            ))}
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {borderWidth: StyleSheet.hairlineWidth},
  card: {borderWidth: StyleSheet.hairlineWidth},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  gridCard: {borderWidth: StyleSheet.hairlineWidth, flexBasis: '47%', flexGrow: 1, minWidth: 160},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  actions: {flexDirection: 'row', flexWrap: 'wrap'},
  actionButton: {flexGrow: 1},
  noteRow: {alignItems: 'center', flexDirection: 'row'},
})
