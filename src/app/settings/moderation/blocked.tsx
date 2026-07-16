import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {AppButton} from '@/components/primitives/AppButton'
import {stubAction} from '@/lib/stubAction'
import {useTheme} from '@/theme/runtime/useTheme'

export default function Screen() {
  const {spacing} = useTheme()
  return (
    <AppScreen scroll>
      <AppText variant="title">Blocked accounts</AppText>
      <AppText colour="textSecondary" style={{marginTop: spacing.sm, marginBottom: spacing.lg}}>
        Blocked accounts list — empty until social provider persists blocks.
      </AppText>
      <AppButton variant="secondary" onPress={() => stubAction('Blocked accounts')}>
        Coming soon
      </AppButton>
    </AppScreen>
  )
}
