import {useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {Image} from 'expo-image'

import {AppText} from '@/components/primitives/AppText'
import {presentMediaSourceMenu} from '@/platform/ui/camera'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import {confirmModulaAction} from '@/platform/ui/menus/confirmModulaAction'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
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
 */
export function ProfileCoverEditor({
  visible,
  initial,
  onClose,
  onSave,
}: ProfileCoverEditorProps) {
  const {colours, spacing} = useThemeTokens()
  const [draft, setDraft] = useState(initial)

  return (
    <ModulaSheet isPresented={visible} onDismiss={onClose} snapPoints={['half', 'full']}>
      <View style={{gap: spacing[4]}}>
        <AppText variant="headline">Edit Cover</AppText>
        <View
          style={[
            styles.preview,
            {backgroundColor: colours.surface2, borderColor: colours.border},
          ]}>
          {draft.uri ? (
            <Image source={{uri: draft.uri}} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <AppText variant="caption" colour="textSecondary">
              {draft.kind === 'none' ? 'No cover' : 'Gradient / solid preview'}
            </AppText>
          )}
        </View>
        <ModulaButton
          label="Choose Photo"
          role="secondary"
          accessibilityLabel="Edit profile cover"
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
        />
        <ModulaButton
          label="Choose Gradient"
          role="secondary"
          onPress={() => setDraft({uri: null, kind: 'gradient'})}
        />
        <ModulaButton
          label="Remove Cover"
          role="destructive"
          onPress={() => {
            void confirmModulaAction({
              title: 'Remove cover?',
              message: 'This only updates the local preview.',
              confirmLabel: 'Remove',
            }).then(ok => {
              if (ok) setDraft({uri: null, kind: 'none'})
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
  preview: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 140,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
})
