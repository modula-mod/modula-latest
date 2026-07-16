import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {AppButton} from '@/components/primitives/AppButton'
import {stubAction} from '@/lib/stubAction'
import {useTheme} from '@/theme/runtime/useTheme'

export default function Screen() {
  const {spacing} = useTheme()
  return (
    <AppScreen scroll>
      <AppText variant="title">Muted accounts</AppText>
      <AppText colour="textSecondary" style={{marginTop: spacing.sm, marginBottom: spacing.lg}}>
        Muted accounts list — empty until social provider persists mutes.
      </AppText>
      <AppButton variant="secondary" onPress={() => stubAction('Muted accounts')}>
        Coming soon
      </AppButton>
    </AppScreen>
  )
}
