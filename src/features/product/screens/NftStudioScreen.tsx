import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const OWNERSHIP_MEANINGS: {
  title: string
  body: string
  icon: AppIconName
}[] = [
  {
    title: 'Module entitlements',
    body: 'Future proof that an account may access a module, tier, add-on, or private workspace. Nothing here grants paid access while DIMON is inactive.',
    icon: 'modules',
  },
  {
    title: 'Creator editions',
    body: 'Reserved limited editions, membership proofs, and collector records without floor-price theatre, live sales, or secondary-market claims.',
    icon: 'poll',
  },
  {
    title: 'Profile collectibles',
    body: 'Planned opt-in profile items and achievements that can decorate identity later but never gate professional use or claim active chain ownership.',
    icon: 'profile',
  },
  {
    title: 'Team credentials',
    body: 'Potential role, certification, and organisation proofs that remain revocable by policy and do not replace team permissions or audit records.',
    icon: 'teams',
  },
]

const PREVIEW_COLLECTIONS: readonly {
  name: string
  status: string
  detail: string
}[] = [
  {
    name: 'Module Access Pass',
    status: 'Reserved preview stub - no mintable collection exists.',
    detail: 'Represents future module entitlement language only; it does not unlock paid modules or show a token ID.',
  },
  {
    name: 'Creator Edition Proof',
    status: 'Reserved preview stub - no creator edition can be minted.',
    detail: 'Represents future creator membership or edition records only; it does not list supply, price, or owner data.',
  },
  {
    name: 'Profile Collectible Badge',
    status: 'Reserved preview stub - no profile collectible ownership is live.',
    detail: 'Represents future profile decoration language only; it does not claim wallet ownership or verification.',
  },
  {
    name: 'Team Credential Proof',
    status: 'Reserved preview stub - no team credential NFT exists.',
    detail: 'Represents future revocable credential language only; team roles and permissions remain the source of truth.',
  },
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

const LINKS: {
  label: string
  detail: string
  href: Href
  icon: AppIconName
}[] = [
  {
    label: 'Design Lab',
    detail: 'Themes and layouts preview where visual identity work can happen before any ownership layer exists.',
    href: '/product/themes',
    icon: 'palette',
  },
  {
    label: 'Ownership & Portability',
    detail: 'Export, permissions, sessions, backups, and future purchase preservation without blockchain claims.',
    href: '/product/ownership',
    icon: 'privacy',
  },
  {
    label: 'Ledger & Replay',
    detail: 'Audit path preview for local product actions, with no chain writes or destructive replay.',
    href: '/product/ledger',
    icon: 'storage',
  },
  {
    label: 'DIMON status',
    detail: 'Inactive ownership-layer status and the honesty boundary for wallets, balances, mints, and settlements.',
    href: '/settings/dimon',
    icon: 'security',
  },
]

export function NftStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="NFT Studio" />
      <ResponsiveContent maxWidth={760}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
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
            <AppText variant="body" colour="textSecondary">
              Every collection, flow, and holder row on this screen is explanatory copy only. There
              are no hidden mint jobs, token IDs, wallet balances, transfer records, prices, or
              settlement events behind these stubs.
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
            <AppText variant="body" colour="textSecondary">
              The intended shape is ownership proof and entitlement language for useful product
              boundaries. It is not casino mechanics, speculative pricing, or a replacement for
              PostgreSQL-backed application state.
            </AppText>
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
              Seeded Preview stubs list their full collection names and statuses. They are product
              taxonomy only: no artwork pipeline, token metadata, supply count, mint queue, owner
              record, wallet balance, floor price, or marketplace listing exists in this build.
            </AppText>
            <View style={[styles.grid, {gap: spacing[3]}]}>
              {PREVIEW_COLLECTIONS.map(collection => (
                <Surface
                  key={collection.name}
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
                  <AppText variant="headline">{collection.name}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    Status: {collection.status}
                  </AppText>
                  <AppText variant="caption" colour="textTertiary">
                    {collection.detail}
                  </AppText>
                </Surface>
              ))}
            </View>
          </View>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Creator flow Preview</AppText>
            <AppText variant="body" colour="textSecondary">
              The flow shows the order a future creator collection would need to pass through:
              definition, metadata, AKI scan, Governor policy, ledger review, and DIMON settlement.
              Only the local definition can be inspected today; all mint and transfer actions remain
              blocked.
            </AppText>
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
              <AppButton
                disabled
                variant="secondary"
                style={styles.actionButton}
                accessibilityLabel="Mint request disabled because ADR-006 keeps PostgreSQL as the primary database and DIMON is not active yet">
                <View style={styles.actionContent}>
                  <AppText variant="label" style={styles.centerText}>
                    Mint request disabled
                  </AppText>
                  <AppText variant="caption" colour="textSecondary" style={styles.centerText}>
                    ADR-006: PostgreSQL is the primary application database; blockchain is not the
                    app database. DIMON is not active yet, so no mint job, token ID, chain write,
                    wallet balance, or settlement event can be created.
                  </AppText>
                </View>
              </AppButton>
              <AppButton
                disabled
                variant="secondary"
                style={styles.actionButton}
                accessibilityLabel="Transfer request disabled because ADR-006 keeps PostgreSQL as the primary database and DIMON is not active yet">
                <View style={styles.actionContent}>
                  <AppText variant="label" style={styles.centerText}>
                    Transfer request disabled
                  </AppText>
                  <AppText variant="caption" colour="textSecondary" style={styles.centerText}>
                    ADR-006: PostgreSQL remains the source of truth for application records.
                    DIMON is not active yet, so there is no wallet transfer, ownership handoff,
                    marketplace settlement, or blockchain success state to run.
                  </AppText>
                </View>
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
            <AppText variant="body" colour="textSecondary">
              Use these linked surfaces for design exploration, ownership controls, and audit
              language while NFT Studio stays an inactive, non-minting preview.
            </AppText>
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
  actionButton: {flexBasis: 300, flexGrow: 1},
  actionContent: {alignItems: 'center', gap: 4},
  centerText: {textAlign: 'center'},
  noteRow: {alignItems: 'center', flexDirection: 'row'},
})
