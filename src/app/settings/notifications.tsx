import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {AppButton} from '@/components/primitives/AppButton'
import {stubAction} from '@/lib/stubAction'
import {useTheme} from '@/theme/runtime/useTheme'

export default function Screen() {
  const {spacing} = useTheme()
  return (
    <AppScreen scroll>
      <AppText variant="title">Notification settings</AppText>
      <AppText colour="textSecondary" style={{marginTop: spacing.sm, marginBottom: spacing.lg}}>
        Push and in-app notification categories. Delivery arrives with a real provider.
      </AppText>
      <AppButton variant="secondary" onPress={() => stubAction('Notification settings')}>
        Coming soon
      </AppButton>
    </AppScreen>
  )
}
