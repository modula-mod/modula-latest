import {useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaPopover} from '@/platform/ui/menus/modula-popover'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Web quality bar: semantic adapters, hover/focus/keyboard — not a fake SwiftUI port. */
export function ExpoUiPlayground() {
  const {spacing} = useThemeTokens()
  const [query, setQuery] = useState('')
  const [sheet, setSheet] = useState(false)
  const [popover, setPopover] = useState(false)
  return (
    <View style={[styles.wrap, {padding: spacing[4], gap: spacing[4]}]}>
      <AppText variant="headline">Web lab</AppText>
      <AppText variant="body" colour="textSecondary">
        Keyboard, hover, focus, pointer, Escape, and screen reader. Glass is a controlled CSS
        fallback — not pixel-identical Liquid Glass.
      </AppText>
      <ModulaButton label="Primary" onPress={() => undefined} />
      <ModulaButton label="Secondary" role="secondary" onPress={() => undefined} />
      <ModulaSearchField value={query} onChangeText={setQuery} placeholder="Search" />
      <ModulaContextMenu
        accessibilityLabel="Web context menu"
        actions={[{id: 'open', label: 'Open'}, {id: 'share', label: 'Share'}]}
        onAction={() => undefined}>
        <AppText variant="body">Right-click or long-press for the web menu adapter.</AppText>
      </ModulaContextMenu>
      <ModulaPopover
        isOpen={popover}
        onOpen={() => setPopover(true)}
        onDismiss={() => setPopover(false)}
        trigger={<AppText variant="buttonLabel">{popover ? 'Hide popover' : 'Show popover'}</AppText>}>
        <AppText variant="body">Popover with focus and Escape.</AppText>
      </ModulaPopover>
      <ModulaButton label="Open sheet" role="secondary" onPress={() => setSheet(true)} />
      <ModulaSheet isPresented={sheet} onDismiss={() => setSheet(false)} snapPoints={['half']}>
        <AppText variant="headline">Sheet / dialog</AppText>
      </ModulaSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
})
