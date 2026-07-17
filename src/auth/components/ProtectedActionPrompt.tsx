import {Modal, StyleSheet, View} from 'react-native'
import {usePathname, useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {MaterialCard} from '@/components/materials/MaterialCard'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProtectedActionPromptProps = {
  visible: boolean
  title?: string
  description?: string
  onClose?: () => void
}

export function ProtectedActionPrompt({
  visible,
  title = 'Sign in to continue',
  description = 'Use a Modula Account to continue this action.',
  onClose,
}: ProtectedActionPromptProps) {
  const router = useRouter()
  const pathname = usePathname()
  const {colours, spacing} = useThemeTokens()
  const close = onClose ?? (() => router.replace('/' as Href))

  const signIn = () => {
    onClose?.()
    router.push(`/sign-in?returnTo=${encodeURIComponent(pathname)}` as Href)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      accessibilityViewIsModal>
      <View style={[styles.backdrop, {backgroundColor: colours.backdrop}]}>
        <MaterialCard style={[styles.card, {gap: spacing[4], padding: spacing[4]}]}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="headline">{title}</AppText>
            <AppText variant="body" colour="textSecondary">
              {description}
            </AppText>
          </View>
          <View style={[styles.actions, {gap: spacing[2]}]}>
            <AppButton onPress={signIn}>Sign in</AppButton>
            <AppButton variant="secondary" onPress={close}>
              Continue browsing
            </AppButton>
          </View>
        </MaterialCard>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    maxWidth: 420,
    width: '100%',
  },
})
