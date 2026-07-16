import {useState} from 'react'
import {Alert, StyleSheet, TextInput, View} from 'react-native'
import {router} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {developmentSocialProvider} from '@/social/adapters'
import {useTheme} from '@/theme/runtime/useTheme'

export default function ComposeScreen() {
  const {colours, spacing, radius} = useTheme()
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  return (
    <AppScreen>
      <View style={[styles.toolbar, {marginBottom: spacing.lg}]}>
        <AppPressable onPress={() => router.back()}>
          <AppText colour="accent">Close</AppText>
        </AppPressable>
        <AppText variant="label">Compose</AppText>
        <AppButton
          disabled={!text.trim() || posting}
          onPress={async () => {
            setPosting(true)
            try {
              await developmentSocialProvider.createPost({text: text.trim()})
              router.back()
            } finally {
              setPosting(false)
            }
          }}>
          Post
        </AppButton>
      </View>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="What is happening?"
        placeholderTextColor={colours.textSecondary}
        multiline
        style={{
          flex: 1,
          color: colours.text,
          fontSize: 18,
          lineHeight: 26,
          textAlignVertical: 'top',
        }}
      />

      <View
        style={[
          styles.tools,
          {
            borderTopColor: colours.border,
            paddingTop: spacing.md,
            gap: spacing.md,
          },
        ]}>
        <AppPressable
          onPress={() =>
            Alert.alert(
              'Composer tools',
              'Tools register later via manifests. The + drawer is a stub in Phase 1.',
            )
          }
          style={[
            styles.plus,
            {
              backgroundColor: colours.surface,
              borderColor: colours.border,
              borderRadius: radius.full,
            },
          ]}>
          <AppText variant="label">+</AppText>
        </AppPressable>
        <AppText variant="caption" colour="textSecondary" style={{flex: 1}}>
          Composer tools drawer — Photo, Poll, Modules, and more arrive through
          manifests.
        </AppText>
      </View>
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  plus: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
})
