import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import type {CommandRisk, ModulaCommand} from '@/features/product/data/commandCatalogue'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const RISK_COPY: Record<CommandRisk, string> = {
  low: 'Low risk: safe to preview and easy to undo in the final product path.',
  medium: 'Medium risk: needs a visible preview and explicit scope check before any write.',
  high: 'High risk: requires explicit confirmation and may be blocked while dependencies are inactive.',
}

const CONFIRM_COPY: Record<ModulaCommand['confirmation'], string> = {
  none: 'No confirmation required for the eventual action, but this preview still does not execute it.',
  preview: 'Preview required: user reviews the plan before the eventual command can run.',
  explicit: 'Explicit confirmation required: the user must approve before any consequential action.',
}

const PERMISSION_COPY: Record<string, string> = {
  'storage:namespaced': 'Namespaced storage only; the command cannot read arbitrary host data.',
  'board:write': 'Board write access for the specific card, widget, or task being previewed.',
  'contacts:read': 'Contact lookup access scoped to the selected CRM/contact operation.',
  'network:declared': 'Network access only to endpoints declared by the module or future command manifest.',
  'dimon:transaction:request': 'Reserved DIMON transaction request scope; blocked while DIMON is inactive.',
  'dimon:asset:transfer:request':
    'Reserved digital-ownership transfer request scope; blocked while DIMON/NFT runtime is inactive.',
}

type CommandPreviewCardProps = {
  command: ModulaCommand
  onDismiss: () => void
}

export function CommandPreviewCard({command, onDismiss}: CommandPreviewCardProps) {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const permissions = command.permissions.length
    ? command.permissions.map(permission => ({
        id: permission,
        copy: PERMISSION_COPY[permission] ?? 'Permission scope is declared by the command manifest.',
      }))
    : [{id: 'none', copy: 'No additional permissions requested.'}]

  return (
    <Surface
      variant="contained"
      style={[
        styles.card,
        {
          backgroundColor: colours.accentSubtle,
          borderColor: colours.accent,
          borderRadius: radius.large,
          padding: spacing[4],
          gap: spacing[3],
        },
      ]}>
      <AppText variant="caption" colour="accent">
        EXECUTABLE PREVIEW / DOES NOT EXECUTE
      </AppText>
      <View style={{gap: spacing[1]}}>
        <AppText variant="headline">{command.label}</AppText>
        <AppText variant="caption" colour="textTertiary">
          {command.id}
        </AppText>
      </View>
      <AppText variant="body" colour="textSecondary">
        {command.description}
      </AppText>
      {command.note ? (
        <AppText variant="caption" colour="textTertiary">
          {command.note}
        </AppText>
      ) : null}
      <View style={{gap: spacing[1]}}>
        <AppText variant="caption" colour="textSecondary">
          Risk / {RISK_COPY[command.risk]}
        </AppText>
        <AppText variant="caption" colour="textSecondary">
          Confirmation / {CONFIRM_COPY[command.confirmation]}
        </AppText>
        <AppText variant="caption" colour="textTertiary">
          Undo policy / {command.undo}
        </AppText>
      </View>
      <View style={{gap: spacing[1]}}>
        <AppText variant="caption" colour="textSecondary">
          Permissions requested
        </AppText>
        {permissions.map(permission => (
          <AppText key={permission.id} variant="caption" colour="textTertiary">
            {permission.id === 'none' ? permission.copy : `${permission.id} / ${permission.copy}`}
          </AppText>
        ))}
      </View>
      {command.id.startsWith('dimon.') ? (
        <AppText variant="caption" colour="textTertiary">
          DIMON is not active yet. NFT, wallet, mint, transfer, and blockchain actions remain blocked.
        </AppText>
      ) : null}
      <View style={[styles.actions, {gap: spacing[2]}]}>
        <AppButton
          variant="secondary"
          onPress={() => router.push('/product/commands' as Href)}
          style={styles.actionButton}>
          Open Command Layer
        </AppButton>
        <AppButton variant="ghost" onPress={onDismiss} style={styles.actionButton}>
          Dismiss Preview
        </AppButton>
      </View>
    </Surface>
  )
}

const styles = StyleSheet.create({
  actions: {flexDirection: 'row', flexWrap: 'wrap'},
  actionButton: {flexGrow: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
})
