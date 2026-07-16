import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {AppButton} from '@/components/primitives/AppButton'
import {stubAction} from '@/lib/stubAction'
import {useTheme} from '@/theme/runtime/useTheme'

export default function Screen() {
  const {spacing} = useTheme()
  return (
    <AppScreen scroll>
      <AppText variant="title">Activity privacy</AppText>
      <AppText colour="textSecondary" style={{marginTop: spacing.sm, marginBottom: spacing.lg}}>
        Control who can see likes, follows, and other activity signals.
      </AppText>
      <AppButton variant="secondary" onPress={() => stubAction('Activity privacy')}>
        Coming soon
      </AppButton>
    </AppScreen>
  )
}
