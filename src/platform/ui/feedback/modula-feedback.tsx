import type {ReactNode} from 'react'
import {ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaIcon} from '@/platform/ui/icons'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'
import {SkeletonBlock} from '@/platform/ui/skeletons/SkeletonBlock'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaNoticeTone = 'info' | 'success' | 'warning' | 'error'

function toneColour(tone: ModulaNoticeTone, colours: ReturnType<typeof useThemeTokens>['colours']) {
  if (tone === 'success') return colours.success
  if (tone === 'warning') return colours.warning
  if (tone === 'error') return colours.destructive
  return colours.accent
}

function toneIcon(tone: ModulaNoticeTone): ModulaIconName {
  if (tone === 'success') return 'check'
  if (tone === 'warning' || tone === 'error') return 'warning'
  return 'info'
}

export function ModulaInlineNotice({
  title,
  message,
  tone = 'info',
  action,
  style,
  testID,
}: {
  title?: string
  message: string
  tone?: ModulaNoticeTone
  action?: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const colour = toneColour(tone, colours)
  return (
    <Surface
      variant="inset"
      style={[
        styles.notice,
        {borderColor: colour, borderRadius: radius.medium, gap: spacing[3], padding: spacing[3]},
        style,
      ]}>
      <ModulaIcon colour={colour} name={toneIcon(tone)} size={20} />
      <View style={[styles.copy, {gap: spacing[1]}]}>
        {title ? <AppText variant="headline">{title}</AppText> : null}
        <AppText variant="caption" colour="textSecondary" testID={testID}>{message}</AppText>
      </View>
      {action}
    </Surface>
  )
}

export const ModulaBanner = ModulaInlineNotice
export const ModulaToast = ModulaInlineNotice

export function ModulaUndoToast({message, onUndo}: {message: string; onUndo: () => void}) {
  return (
    <ModulaInlineNotice
      action={<ModulaButton label="Undo" onPress={onUndo} role="inline" />}
      message={message}
    />
  )
}

export function ModulaProgressNotice({message}: {message: string}) {
  const {colours} = useThemeTokens()
  return (
    <ModulaInlineNotice
      action={<ActivityIndicator accessibilityLabel="In progress" color={colours.accent} />}
      message={message}
    />
  )
}

export function ModulaEmptyState({
  icon = 'info',
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  icon?: ModulaIconName
  title: string
  description: string
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View role="group" style={[styles.state, {gap: spacing[3], padding: spacing[6]}]}>
      <ModulaIcon name={icon} size={32} colour={colours.textSecondary} />
      <AppText variant="title" style={styles.center}>{title}</AppText>
      <AppText variant="body" colour="textSecondary" style={styles.center}>{description}</AppText>
      {primaryAction}
      {secondaryAction}
    </View>
  )
}

export function ModulaErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  scope = 'section',
}: {
  title?: string
  message: string
  onRetry?: () => void
  scope?: 'inline' | 'section' | 'screen' | 'recoverable' | 'offline'
}) {
  if (scope === 'inline') return <ModulaInlineNotice title={title} message={message} tone="error" />
  return (
    <ModulaEmptyState
      description={message}
      icon="warning"
      primaryAction={onRetry ? <ModulaButton label="Try again" onPress={onRetry} /> : undefined}
      title={scope === 'offline' ? 'You’re offline' : title}
    />
  )
}

export function ModulaLoadingSection({rows = 3}: {rows?: number}) {
  const {radius, spacing} = useThemeTokens()
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={{gap: spacing[3]}}>
      {Array.from({length: rows}, (_, index) => (
        <SkeletonBlock key={index} height={52} borderRadius={radius.medium} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  center: {textAlign: 'center'},
  copy: {flex: 1, minWidth: 0},
  notice: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
