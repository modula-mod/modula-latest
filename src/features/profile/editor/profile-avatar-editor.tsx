import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {Image} from 'expo-image'

import {AppText} from '@/components/primitives/AppText'
import {presentMediaSourceMenu} from '@/platform/ui/camera'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ProfileAvatarDraft = {
  uri: string | null
  sourceUri: string | null
}

type ProfileAvatarEditorProps = {
  visible: boolean
  initial: ProfileAvatarDraft
  onClose: () => void
  onSave: (draft: ProfileAvatarDraft) => void
}

/** Circular crop preview for local avatar edits. Keeps the original URI. */
export function ProfileAvatarEditor({
  visible,
  initial,
  onClose,
  onSave,
}: ProfileAvatarEditorProps) {
  const {colours, spacing} = useThemeTokens()
  const [draft, setDraft] = useState(initial)

  return (
    <ModulaSheet isPresented={visible} onDismiss={onClose} snapPoints={['half', 'full']}>
      <View style={{gap: spacing[4], alignItems: 'center'}}>
        <AppText variant="headline">Edit Profile Photo</AppText>
        <View
          style={[
            styles.preview,
            {backgroundColor: colours.surface2, borderColor: colours.border},
          ]}>
          {draft.uri ? (
            <Image source={{uri: draft.uri}} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <AppText variant="caption" colour="textSecondary">
              No photo
            </AppText>
          )}
        </View>
        <ModulaButton
          label="Choose Photo"
          role="secondary"
          accessibilityLabel="Change profile photo"
          onPress={() => {
            void presentMediaSourceMenu({
              title: 'Profile photo',
              target: 'avatar',
              allowsEditing: true,
              aspect: [1, 1],
            }).then(result => {
              if (result.ok) {
                setDraft({uri: result.asset.uri, sourceUri: result.asset.uri})
              }
            })
          }}
        />
        <ModulaButton
          label="Remove"
          role="destructive"
          onPress={() => {
            void confirmModulaAction({
              title: 'Remove photo?',
              message: 'Local preview only — the original URI is retained for later upload.',
              confirmLabel: 'Remove',
            }).then(ok => {
              if (ok) setDraft(prev => ({uri: null, sourceUri: prev.sourceUri}))
            })
          }}
        />
        <View style={[styles.row, {gap: spacing[2]}]}>
          <ModulaButton label="Cancel" role="plain" onPress={onClose} />
          <ModulaButton
            label="Save"
            role="primary"
            onPress={() => {
              onSave(draft)
              onClose()
            }}
          />
        </View>
      </View>
    </ModulaSheet>
  )
}

const styles = StyleSheet.create({
  preview: {
    alignItems: 'center',
    borderRadius: 80,
    borderWidth: StyleSheet.hairlineWidth,
    height: 160,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 160,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
})
