import {ScrollView, StyleSheet, Switch, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import type {ChatAssistMode} from '@/features/product/storage/productPreferencesStorage'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const MODES: {id: ChatAssistMode; label: string; detail: string}[] = [
  {id: 'off', label: 'Off', detail: 'No assist suggestions.'},
  {
    id: 'on-device',
    label: 'On-device only',
    detail: 'Reserved for local models and heuristics; no remote calls.',
  },
  {
    id: 'manual',
    label: 'Manual request',
    detail: 'Assist appears only when the user asks.',
  },
  {
    id: 'selected',
    label: 'Selected functions',
    detail: 'Only checked functions are allowed to appear.',
  },
  {
    id: 'full',
    label: 'Fully enabled',
    detail: 'Still gated by permissions and confirmation rules.',
  },
]

const FUNCTIONS = [
  {id: 'summarise', label: 'Summarise', detail: 'Conversation summary cards.'},
  {id: 'suggested-replies', label: 'Suggested replies', detail: 'Draft options, never auto-send.'},
  {id: 'tone', label: 'Tone', detail: 'Rewrite draft style locally in Preview.'},
  {id: 'translate', label: 'Translate', detail: 'Language assist placeholder.'},
  {id: 'action-items', label: 'Action items', detail: 'Extract follow-ups into a review list.'},
  {id: 'chat-to-task', label: 'Chat-to-task', detail: 'Prepare a task command preview.'},
  {id: 'chat-to-note', label: 'Chat-to-note', detail: 'Prepare a note command preview.'},
  {id: 'quiet-send', label: 'Quiet send', detail: 'Hold messages during Focus windows.'},
  {id: 'catch-up', label: 'Catch-up', detail: 'Read-only missed-message digest.'},
]

const HELD_MESSAGES = [
  {
    id: 'reply-1',
    title: 'Team chat follow-up',
    body: 'Held because Deep Focus avoids non-urgent sends.',
  },
  {
    id: 'reply-2',
    title: 'Creator collaboration DM',
    body: 'Draft remains local until the user reviews and sends manually.',
  },
  {
    id: 'reply-3',
    title: 'CRM check-in',
    body: 'Quiet Send can prepare timing hints, but no remote send occurs.',
  },
]

export function ChatAssistScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const {preferences, ready, update} = useProductPreferences()
  const selectedFunctions = new Set(preferences.chatAssistFunctions)
  const focusPreset = preferences.focus.preset ?? 'off'
  const showHeldMessages =
    preferences.quietSendEnabled || focusPreset === 'deep' || focusPreset === 'custom'

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Chat Assist" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="caption" colour="accent">
              LOCAL PREFERENCES / NO SILENT PRIVATE AI
            </AppText>
            <AppText variant="display">Assist for messages, with clear boundaries.</AppText>
            <AppText variant="body" colour="textSecondary">
              Chat Assist is disabled by default and saved locally. This Preview does not call a
              remote model, read Vault Chat, or send messages for you.{!ready ? ' Loading...' : ''}
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.note,
              {
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
                borderRadius: radius.medium,
                padding: spacing[4],
                gap: spacing[2],
              },
            ]}>
            <AppText variant="label">Vault Chat boundary</AppText>
            <AppText variant="caption" colour="textSecondary">
              Chat Assist is disabled by default for Vault Chat. Future Vault support requires an
              explicit per-chat permission and local-first review.
            </AppText>
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Permission mode</AppText>
            {MODES.map(mode => {
              const selected = preferences.chatAssistMode === mode.id
              return (
                <AppPressable
                  key={mode.id}
                  accessibilityLabel={mode.label}
                  accessibilityState={{selected}}
                  onPress={() => {
                    void update({chatAssistMode: mode.id})
                  }}
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: selected ? colours.accentSubtle : colours.surface,
                      borderColor: selected ? colours.accent : colours.border,
                      borderRadius: radius.medium,
                      padding: spacing[4],
                      gap: spacing[1],
                    },
                  ]}>
                  <View style={[styles.titleRow, {gap: spacing[2]}]}>
                    <AppIcon name={selected ? 'check' : 'privacy'} colour={colours.accent} size={18} />
                    <AppText variant="headline" style={{flex: 1}}>
                      {mode.label}
                    </AppText>
                  </View>
                  <AppText variant="caption" colour="textSecondary">
                    {mode.detail}
                  </AppText>
                </AppPressable>
              )
            })}
          </View>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Functions</AppText>
            {FUNCTIONS.map(item => {
              const enabled = selectedFunctions.has(item.id)
              return (
                <Surface
                  key={item.id}
                  variant="contained"
                  style={[
                    styles.functionRow,
                    {
                      backgroundColor: colours.surface,
                      borderColor: enabled ? colours.accent : colours.border,
                      borderRadius: radius.medium,
                      padding: spacing[3],
                      gap: spacing[3],
                    },
                  ]}>
                  <View style={{flex: 1, gap: spacing[1]}}>
                    <AppText variant="headline">{item.label}</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {item.detail}
                    </AppText>
                  </View>
                  <Switch
                    accessibilityLabel={`Toggle ${item.label}`}
                    value={enabled}
                    onValueChange={value => {
                      const next = value
                        ? [...preferences.chatAssistFunctions, item.id]
                        : preferences.chatAssistFunctions.filter(id => id !== item.id)
                      void update({chatAssistFunctions: Array.from(new Set(next))})
                    }}
                  />
                </Surface>
              )
            })}
          </View>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.large,
                padding: spacing[4],
                gap: spacing[3],
              },
            ]}>
            <View style={[styles.titleRow, {gap: spacing[2]}]}>
              <AppIcon name="send" colour={colours.accent} />
              <View style={{flex: 1, gap: spacing[1]}}>
                <AppText variant="headline">Quiet Send preview</AppText>
                <AppText variant="caption" colour="textSecondary">
                  Hold drafted messages while Focus is Deep/Custom, or when Quiet Send is enabled.
                </AppText>
              </View>
              <Switch
                accessibilityLabel="Enable Quiet Send"
                value={preferences.quietSendEnabled}
                onValueChange={value => {
                  void update({quietSendEnabled: value})
                }}
              />
            </View>
            <AppText variant="caption" colour="textTertiary">
              Focus preset / {focusPreset}. Explicit: no remote send happens from this Preview.
            </AppText>
            {showHeldMessages ? (
              <View style={{gap: spacing[2]}}>
                {HELD_MESSAGES.map(message => (
                  <Surface
                    key={message.id}
                    variant="contained"
                    style={[
                      styles.held,
                      {
                        backgroundColor: colours.surfaceRaised,
                        borderColor: colours.border,
                        borderRadius: radius.medium,
                        padding: spacing[3],
                        gap: spacing[1],
                      },
                    ]}>
                    <AppText variant="label">{message.title}</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {message.body}
                    </AppText>
                  </Surface>
                ))}
              </View>
            ) : (
              <AppText variant="body" colour="textSecondary">
                No held messages are shown until Deep/Custom Focus or Quiet Send is enabled.
              </AppText>
            )}
          </Surface>

          <AppButton onPress={() => router.push('/messages' as Href)}>Open Messages</AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/focus' as Href)}>
            Focus Mode
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  note: {borderWidth: StyleSheet.hairlineWidth},
  modeCard: {borderWidth: StyleSheet.hairlineWidth},
  titleRow: {alignItems: 'center', flexDirection: 'row'},
  functionRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  card: {borderWidth: StyleSheet.hairlineWidth},
  held: {borderWidth: StyleSheet.hairlineWidth},
})
