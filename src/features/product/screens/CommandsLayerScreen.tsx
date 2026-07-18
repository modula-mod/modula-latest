import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {COMMAND_CATALOGUE, type CommandRisk} from '@/features/product/data/commandCatalogue'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const RISK: Record<CommandRisk, string> = {
  low: 'Low',
  medium: 'Needs preview',
  high: 'Explicit confirm',
}

export function CommandsLayerScreen() {
  const router = useRouter()
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const [query, setQuery] = useState('')
  const wash =
    scheme === 'dark'
      ? ['#0B1416', colours.accentSubtle]
      : [colours.accentSubtle, colours.canvas]

  const commands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMAND_CATALOGUE
    return COMMAND_CATALOGUE.filter(cmd =>
      `${cmd.id} ${cmd.label} ${cmd.description}`.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Command Layer" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <LinearGradient
            colors={wash as [string, string]}
            style={[
              styles.hero,
              {
                borderRadius: radius.large,
                padding: spacing[5],
                gap: spacing[2],
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="accent">
              ROUTER · SEARCH · GAIA · AUTOMATIONS
            </AppText>
            <AppText variant="display">One router for every capability.</AppText>
            <AppText variant="body" colour="textSecondary">
              Start, Search, GAIA, Composer Tools, Automations, and deep links all resolve to typed
              commands with risk, preview, confirmation, and Ledger policy.
            </AppText>
          </LinearGradient>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search commands — e.g. focus, task, send"
            placeholderTextColor={colours.textTertiary}
            accessibilityLabel="Search commands"
            style={[
              styles.input,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.medium,
                color: colours.text,
                paddingHorizontal: spacing[4],
              },
            ]}
          />

          {commands.map(cmd => (
            <Surface
              key={cmd.id}
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
              <View style={[styles.titleRow, {gap: spacing[2]}]}>
                <AppIcon name="developer" colour={colours.accent} size={18} />
                <AppText variant="headline" style={{flex: 1}}>
                  {cmd.label}
                </AppText>
                <AppText variant="caption" colour="accent">
                  {RISK[cmd.risk]}
                </AppText>
              </View>
              <AppText variant="caption" colour="textTertiary">
                {cmd.id}
              </AppText>
              <AppText variant="body" colour="textSecondary">
                {cmd.description}
              </AppText>
              {cmd.note ? (
                <AppText variant="caption" colour="textTertiary">
                  {cmd.note}
                </AppText>
              ) : null}
              <AppText variant="caption" colour="textSecondary">
                Confirm · {cmd.confirmation} · Undo · {cmd.undo}
              </AppText>
              {cmd.permissions.length ? (
                <AppText variant="caption" colour="textTertiary">
                  Permissions · {cmd.permissions.join(', ')}
                </AppText>
              ) : null}
              {cmd.id.startsWith('focus.') ? (
                <AppPressable onPress={() => router.push('/product/focus' as Href)}>
                  <AppText variant="caption" colour="accent">
                    Open Focus Mode →
                  </AppText>
                </AppPressable>
              ) : null}
              {cmd.id.startsWith('dimon.') ? (
                <AppText variant="caption" colour="textTertiary">
                  DIMON is not active yet
                </AppText>
              ) : null}
            </Surface>
          ))}

          <AppButton onPress={() => router.push('/product/intelligence' as Href)}>
            Intelligence Hub
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/gaia' as Href)}>
            GAIA
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/aki' as Href)}>
            AKI verification
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {borderWidth: StyleSheet.hairlineWidth, width: '100%'},
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 48},
  card: {borderWidth: StyleSheet.hairlineWidth},
  titleRow: {alignItems: 'center', flexDirection: 'row'},
})
