import * as Clipboard from 'expo-clipboard'
import {useMemo, useState} from 'react'
import {Alert, ScrollView, Share, StyleSheet, TextInput, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ShareToSheetProps = {
  isPresented: boolean
  onDismiss: () => void
  title?: string
  permalink: string
  shareMessage: string
  testID?: string
}

const shareTargets: {id: string; name: string; handle: string}[] = []

/**
 * Share-to BottomSheet: search seeded people, Copy link, Share via system, DM Preview.
 * Inspired by IMG_0317 — Modula-branded, Preview-honest for DMs.
 */
export function ShareToSheet({
  isPresented,
  onDismiss,
  title = 'Share',
  permalink,
  shareMessage,
  testID = 'share-to-sheet',
}: ShareToSheetProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const [query, setQuery] = useState('')

  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return shareTargets
    return shareTargets.filter(
      thread =>
        thread.name.toLowerCase().includes(q) || thread.handle.toLowerCase().includes(q),
    )
  }, [query])

  const copyLink = async () => {
    await Clipboard.setStringAsync(permalink)
    void selectionHaptic()
    Alert.alert('Copied', 'Link copied to the clipboard.')
  }

  const shareVia = async () => {
    try {
      await Share.share({message: shareMessage, url: permalink})
      void selectionHaptic()
    } catch {
      Alert.alert('Share unavailable', shareMessage)
    }
  }

  return (
    <ModulaSheet
      isPresented={isPresented}
      onDismiss={() => {
        setQuery('')
        onDismiss()
      }}
      snapPoints={['half', 'full']}
      testID={testID}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{gap: spacing[4], paddingBottom: spacing[6]}}>
        <AppText variant="headline">{title}</AppText>
        <View
          style={[
            styles.search,
            {
              backgroundColor: colours.surfaceMuted,
              borderRadius: radius.round,
              gap: spacing[2],
              paddingHorizontal: spacing[3],
            },
          ]}>
          <AppIcon name="search" colour={colours.textTertiary} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people"
            placeholderTextColor={colours.textTertiary}
            accessibilityLabel="Search people to share with"
            style={[styles.searchInput, {color: colours.text}]}
          />
        </View>

        <View style={{gap: spacing[2]}}>
          <AppText variant="label" colour="textSecondary">
            Send in Messages — Preview
          </AppText>
          {people.map(person => (
            <AppPressable
              key={person.id}
              accessibilityLabel={`Share to ${person.name} Preview`}
              onPress={() => {
                void selectionHaptic()
                Alert.alert(
                  'DM share — Preview',
                  `Sharing to @${person.handle} is a local Preview. No message is sent.`,
                )
              }}
              style={[styles.person, {gap: spacing[3], minHeight: 52}]}>
              <Avatar name={person.name} size={40} />
              <View style={{flex: 1}}>
                <AppText variant="label">{person.name}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  @{person.handle}
                </AppText>
              </View>
              <AppIcon name="send" colour={colours.accent} size={18} />
            </AppPressable>
          ))}
        </View>

        <View style={{gap: spacing[2]}}>
          <AppPressable
            accessibilityLabel="Copy link"
            onPress={() => void copyLink()}
            style={[
              styles.action,
              {
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
                borderRadius: radius.md,
              },
            ]}>
            <AppIcon name="link" colour={colours.accent} />
            <AppText variant="label">Copy link</AppText>
          </AppPressable>
          <AppPressable
            accessibilityLabel="Share via system"
            onPress={() => void shareVia()}
            style={[
              styles.action,
              {
                backgroundColor: colours.accentSubtle,
                borderColor: colours.accent,
                borderRadius: radius.md,
              },
            ]}>
            <AppIcon name="share" colour={colours.accent} />
            <AppText variant="label" style={{color: colours.accent}}>
              Share via…
            </AppText>
          </AppPressable>
        </View>
      </ScrollView>
    </ModulaSheet>
  )
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  person: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  search: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 44,
  },
})
