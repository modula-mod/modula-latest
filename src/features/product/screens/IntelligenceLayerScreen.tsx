import {ScrollView, StyleSheet, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Surface} from '@/components/primitives/Surface'
import {
  getIntelligenceLayer,
  type IntelligenceLayerId,
} from '@/features/product/data/intelligenceLayers'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function IntelligenceLayerScreen() {
  const {slug} = useLocalSearchParams<{slug: string}>()
  const layer = getIntelligenceLayer(String(slug ?? ''))
  const router = useRouter()
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const wash =
    scheme === 'dark'
      ? ['#0B1416', colours.accentSubtle]
      : [colours.accentSubtle, colours.canvas]

  if (!layer) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
        <SecondaryScreenHeader title="Intelligence" />
        <EmptyState
          icon="info"
          title="Layer not found"
          description="Open the Intelligence Hub for the canonical map."
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={layer.name} />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <LinearGradient
            colors={wash as [string, string]}
            style={[
              styles.hero,
              {
                borderRadius: radius.large,
                padding: spacing[5],
                gap: spacing[3],
                borderColor: colours.border,
              },
            ]}>
            <AppIcon name={layer.icon} colour={colours.accent} size={28} />
            <AppText variant="caption" colour="accent">
              {layer.maturity.toUpperCase()} · {layer.interpretation}
            </AppText>
            <AppText variant="display">{layer.name}</AppText>
            <AppText variant="body" colour="textSecondary">
              {layer.role}
            </AppText>
          </LinearGradient>

          <LayerInteractivePreview
            id={layer.id}
            colours={colours}
            radius={radius}
            spacing={spacing}
          />

          <Section title="Responsibilities" colours={colours} radius={radius} spacing={spacing}>
            {layer.responsibilities.map(item => (
              <Bullet key={item} text={item} colours={colours} spacing={spacing} />
            ))}
          </Section>

          <Section title="Must not" colours={colours} radius={radius} spacing={spacing}>
            {layer.mustNot.map(item => (
              <Bullet key={item} text={item} colours={colours} spacing={spacing} warning />
            ))}
          </Section>

          <Section title="MVP Preview" colours={colours} radius={radius} spacing={spacing}>
            {layer.mvp.map(item => (
              <Bullet key={item} text={item} colours={colours} spacing={spacing} />
            ))}
          </Section>

          <AppText variant="caption" colour="textTertiary">
            Preview surface — explains architecture. No production model runtime, unrestricted agent,
            or silent private access.
          </AppText>

          <AppButton onPress={() => router.push('/product/intelligence' as Href)}>
            Intelligence Hub
          </AppButton>
          {layer.id !== 'gaia' ? (
            <AppButton variant="secondary" onPress={() => router.push('/product/gaia' as Href)}>
              Open GAIA
            </AppButton>
          ) : null}
          {layer.id !== 'aki' ? (
            <AppButton variant="ghost" onPress={() => router.push('/product/aki' as Href)}>
              Open AKI
            </AppButton>
          ) : null}
          {layer.id !== 'commands' ? (
            <AppButton variant="ghost" onPress={() => router.push('/product/commands' as Href)}>
              Command Layer
            </AppButton>
          ) : null}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function LayerInteractivePreview({
  id,
  colours,
  radius,
  spacing,
}: {
  id: IntelligenceLayerId
  colours: {surface: string; border: string; accent: string; surfaceRaised: string}
  radius: {large: number; medium: number}
  spacing: Record<number, number>
}) {
  const samples = PREVIEW_SAMPLES[id]
  if (!samples) return null

  return (
    <Surface
      variant="contained"
      style={{
        padding: spacing[4],
        gap: spacing[3],
        borderRadius: radius.large,
        backgroundColor: colours.surface,
        borderColor: colours.border,
        borderWidth: StyleSheet.hairlineWidth,
      }}>
      <AppText variant="caption" colour="accent">
        {samples.eyebrow}
      </AppText>
      <AppText variant="headline">{samples.title}</AppText>
      {samples.rows.map(row => (
        <View
          key={row.label}
          style={{
            gap: spacing[1],
            padding: spacing[3],
            borderRadius: radius.medium,
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.border,
            borderWidth: StyleSheet.hairlineWidth,
          }}>
          <AppText variant="label">{row.label}</AppText>
          <AppText variant="caption" colour="textSecondary">
            {row.detail}
          </AppText>
        </View>
      ))}
      <AppText variant="micro" colour="textTertiary">
        Seeded Preview data — not a live runtime.
      </AppText>
    </Surface>
  )
}

const PREVIEW_SAMPLES: Partial<
  Record<
    IntelligenceLayerId,
    {eyebrow: string; title: string; rows: Array<{label: string; detail: string}>}
  >
> = {
  aki: {
    eyebrow: 'ACTION VERIFICATION PREVIEW',
    title: 'Would AKI allow this?',
    rows: [
      {
        label: 'messaging.send · batch follow-ups',
        detail: 'Risk high · requires Governor batch approval · recipient claims unverified',
      },
      {
        label: 'tasks.create · from chat',
        detail: 'Risk low · preview OK · confirm once · Ledger required',
      },
      {
        label: 'module.install · unreviewed package',
        detail: 'Rejected · manifest permissions exceed declared purpose',
      },
    ],
  },
  governor: {
    eyebrow: 'AUTONOMY PRESETS',
    title: 'Policy cards (Preview)',
    rows: [
      {label: 'Suggest only', detail: 'GAIA proposes; never executes writes'},
      {label: 'Confirm each', detail: 'User approves every consequential command'},
      {label: 'Restricted Focus', detail: 'Deep Focus pauses unsolicited GAIA'},
    ],
  },
  'circuit-memory': {
    eyebrow: 'MEMORY CENTRE PREVIEW',
    title: 'Retained patterns (local stub)',
    rows: [
      {label: 'User · Board morning brief', detail: 'Validated pattern · AKI approved'},
      {label: 'Module · tasks.create defaults', detail: 'Preference · editable / deletable'},
      {label: 'Session · current Focus Deep', detail: 'Temporary · cleared when session ends'},
    ],
  },
  kaizen: {
    eyebrow: 'IMPROVE QUEUE',
    title: 'Capture → classify → review',
    rows: [
      {label: 'Board widget density', detail: 'Visual · clustered ×3 · awaiting propose'},
      {label: 'Focus Deep nav hide', detail: 'Feature · linked to FocusPolicyEngine'},
      {label: 'GAIA interrupt under Deep', detail: 'Intelligence failure · verify then approve'},
    ],
  },
  foundry: {
    eyebrow: 'PIPELINE GATE',
    title: 'No training until foundations pass',
    rows: [
      {label: 'Dataset provenance', detail: 'Blocked — repair links first'},
      {label: 'Human review packs', detail: 'Blocked — not assembled'},
      {label: 'Evaluation gate', detail: 'Blocked — no student model yet'},
    ],
  },
  'claims-graph': {
    eyebrow: 'SAMPLE CLAIMS',
    title: 'Evidence-backed nodes',
    rows: [
      {
        label: 'Module X · Expo SDK 55 compatible',
        detail: 'Confidence 0.72 · expires 90d · 1 conflicting note',
      },
      {
        label: 'User prefers Deep Focus mornings',
        detail: 'Preference · Circuit Memory linked · not a fact claim',
      },
    ],
  },
  ledger: {
    eyebrow: 'LEDGER ROWS',
    title: 'Black-box recorder Preview',
    rows: [
      {
        label: 'focus.start · Deep',
        detail: 'Initiator user · AKI n/a · Governor allow · completed · undo: focus.stop',
      },
      {
        label: 'gaia.plan · Board brief',
        detail: 'Read-only · scopes [tasks,composer] · no side effects',
      },
      {
        label: 'messaging.send · held',
        detail: 'AKI reject · Governor require approval · awaiting human',
      },
    ],
  },
}

function Section({
  title,
  children,
  colours,
  radius,
  spacing,
}: {
  title: string
  children: React.ReactNode
  colours: {surface: string; border: string}
  radius: {large: number}
  spacing: Record<number, number>
}) {
  return (
    <Surface
      variant="contained"
      style={{
        padding: spacing[4],
        gap: spacing[3],
        borderRadius: radius.large,
        backgroundColor: colours.surface,
        borderColor: colours.border,
        borderWidth: StyleSheet.hairlineWidth,
      }}>
      <AppText variant="headline">{title}</AppText>
      {children}
    </Surface>
  )
}

function Bullet({
  text,
  colours,
  spacing,
  warning,
}: {
  text: string
  colours: {accent: string; textTertiary: string}
  spacing: Record<number, number>
  warning?: boolean
}) {
  return (
    <View style={{flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start'}}>
      <AppIcon name={warning ? 'warning' : 'check'} colour={colours.accent} size={16} />
      <AppText variant="body" colour="textSecondary" style={{flex: 1}}>
        {text}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {borderWidth: StyleSheet.hairlineWidth, width: '100%'},
})
