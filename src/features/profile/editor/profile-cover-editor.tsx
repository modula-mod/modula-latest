import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {Image} from 'expo-image'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {presentMediaSourceMenu} from '@/platform/ui/camera'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ProfileCoverDraft = {
  uri: string | null
  kind: 'photo' | 'gradient' | 'solid' | 'none'
}

type ProfileCoverEditorProps = {
  visible: boolean
  initial: ProfileCoverDraft
  onClose: () => void
  onSave: (draft: ProfileCoverDraft) => void
}

/**
 * Local-session cover editor. Does not claim remote upload.
 * Uses AppPressable rows (not Expo UI Host buttons) so labels stay readable
 * on glass/dark sheet chrome.
 */
export function ProfileCoverEditor({
  visible,
  initial,
  onClose,
  onSave,
}: ProfileCoverEditorProps) {
  const {colours, spacing, radius} = useThemeTokens()
  const [draft, setDraft] = useState(initial)

  return (
    <ModulaSheet isPresented={visible} onDismiss={onClose} snapPoints={['half', 'full']}>
      <View style={[styles.root, {gap: spacing[4]}]}>
        <AppText variant="headline">Edit Cover</AppText>
        <View
          style={[
            styles.preview,
            {
              backgroundColor: colours.surfaceRaised,
              borderColor: colours.border,
              borderRadius: radius.large,
            },
          ]}>
          {draft.uri ? (
            <Image source={{uri: draft.uri}} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <AppText variant="caption" colour="textSecondary">
              {draft.kind === 'none' ? 'No cover' : 'Gradient / solid preview'}
            </AppText>
          )}
        </View>

        <AppPressable
          accessibilityLabel="Choose cover photo"
          onPress={() => {
            void presentMediaSourceMenu({
              title: 'Cover photo',
              target: 'cover',
            }).then(result => {
              if (result.ok) {
                setDraft({uri: result.asset.uri, kind: 'photo'})
              }
            })
          }}
          style={[
            styles.action,
            {
              backgroundColor: colours.surfaceRaised,
              borderColor: colours.border,
              borderRadius: radius.round,
            },
          ]}>
          <AppText variant="label">Choose Photo</AppText>
        </AppPressable>

        <AppPressable
          accessibilityLabel="Choose cover gradient"
          onPress={() => setDraft({uri: null, kind: 'gradient'})}
          style={[
            styles.action,
            {
              backgroundColor: colours.surfaceRaised,
              borderColor: colours.border,
              borderRadius: radius.round,
            },
          ]}>
          <AppText variant="label">Choose Gradient</AppText>
        </AppPressable>

        <AppPressable
          accessibilityLabel="Remove cover"
          onPress={() => {
            void confirmModulaAction({
              title: 'Remove cover?',
              message: 'This only updates the local preview.',
              confirmLabel: 'Remove',
            }).then(ok => {
              if (ok) setDraft({uri: null, kind: 'none'})
            })
          }}
          style={[
            styles.action,
            {
              backgroundColor: colours.destructive,
              borderColor: colours.destructive,
              borderRadius: radius.round,
            },
          ]}>
          <AppText variant="label" style={styles.onFill}>
            Remove Cover
          </AppText>
        </AppPressable>

        <View style={[styles.row, {gap: spacing[2]}]}>
          <AppPressable
            accessibilityLabel="Cancel cover edit"
            onPress={onClose}
            style={[styles.footerBtn, {borderRadius: radius.round}]}>
            <AppText variant="label" colour="textSecondary">
              Cancel
            </AppText>
          </AppPressable>
          <AppPressable
            accessibilityLabel="Save cover"
            onPress={() => {
              onSave(draft)
              onClose()
            }}
            style={[
              styles.footerBtn,
              styles.saveBtn,
              {
                backgroundColor: colours.accent,
                borderRadius: radius.round,
              },
            ]}>
            <AppText variant="label" style={styles.onFill}>
              Save
            </AppText>
          </AppPressable>
        </View>
      </View>
    </ModulaSheet>
  )
}

export async function presentProfileCoverEditorMenu(): Promise<string | null> {
  return presentModulaActions({
    title: 'Edit Cover',
    actions: [
      {id: 'photo', label: 'Choose Photo'},
      {id: 'camera', label: 'Take Photo'},
      {id: 'gradient', label: 'Choose Gradient'},
      {id: 'reposition', label: 'Reposition'},
      {id: 'remove', label: 'Remove Cover', style: 'destructive'},
    ],
  })
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    width: '100%',
  },
  footerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  preview: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    height: 140,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  root: {
    alignSelf: 'stretch',
    width: '100%',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
  onFill: {
    color: '#FFFFFF',
  },
  saveBtn: {
    minWidth: 88,
  },
})
