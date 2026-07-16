import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {AppButton} from '@/components/primitives/AppButton'
import {stubAction} from '@/lib/stubAction'
import {useTheme} from '@/theme/runtime/useTheme'

export default function Screen() {
  const {spacing} = useTheme()
  return (
    <AppScreen scroll>
      <AppText variant="title">Marketplace</AppText>
      <AppText colour="textSecondary" style={{marginTop: spacing.sm, marginBottom: spacing.lg}}>
        Discover modules, widgets, themes, and composer tools. Backend deferred to Phase 7.
      </AppText>
      <AppButton variant="secondary" onPress={() => stubAction('Marketplace')}>
        Coming soon
      </AppButton>
    </AppScreen>
  )
}
