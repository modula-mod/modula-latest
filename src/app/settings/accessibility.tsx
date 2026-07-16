import {useState} from 'react'

import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {SystemListRow, SystemSection, SystemSwitch} from '@/components/system'
import {useTheme} from '@/theme/runtime/useTheme'

export default function AccessibilitySettingsScreen() {
  const {spacing} = useTheme()
  const [reduceMotion, setReduceMotion] = useState(false)
  const [largerText, setLargerText] = useState(false)

  return (
    <AppScreen scroll>
      <AppText colour="textSecondary" style={{marginBottom: spacing.lg}}>
        Local stubs — preferences are not persisted yet.
      </AppText>
      <SystemSection title="Motion & text">
        <SystemListRow
          title="Reduce motion"
          right={<SystemSwitch value={reduceMotion} onValueChange={setReduceMotion} />}
        />
        <SystemListRow
          title="Larger text (stub)"
          right={<SystemSwitch value={largerText} onValueChange={setLargerText} />}
          showDivider={false}
        />
      </SystemSection>
    </AppScreen>
  )
}
