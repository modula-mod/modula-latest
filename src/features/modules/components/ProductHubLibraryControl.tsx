import {useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  ProductHubSegmentedControl,
  type ProductHubSegment,
} from '@/features/modules/components/ProductHubSegmentedControl'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {ModulaIcon} from '@/platform/ui/icons'
import {LiquidGlassChrome} from '@/platform/ui/materials/liquid-glass-chrome'
import {ModulaPopover} from '@/platform/ui/menus/modula-popover'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const LABELS: {value: ProductHubSegment; label: string}[] = [
  {value: 'discover', label: 'Discover'},
  {value: 'installed', label: 'Installed'},
  {value: 'updates', label: 'Updates'},
]

/** Full labels for the Home-style header menu — never truncated to “Disco…”. */
export const PRODUCT_HUB_LIBRARY_ACTIONS: ModulaActionItem[] = LABELS.map(option => ({
  id: option.value,
  label: option.label,
  icon: option.value === 'discover' ? 'discover' : option.value === 'installed' ? 'modules' : 'download',
}))

/**
 * Library navigation without a stacked utility block.
 * Production Product Hub uses ChromeGlassControlGroup + these actions.
 * This popover remains for UI Lab / wide fallback specimens.
 */
export function ProductHubLibraryControl({
  value,
  onChange,
  updatesDisabled = false,
  wide,
}: {
  value: ProductHubSegment
  onChange: (value: ProductHubSegment) => void
  updatesDisabled?: boolean
  wide: boolean
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const [open, setOpen] = useState(false)
  const current = LABELS.find(option => option.value === value)?.label ?? 'Discover'

  if (wide) {
    return (
      <View testID="product-hub-library-wide">
        <ProductHubSegmentedControl
          value={value}
          onChange={onChange}
          updatesDisabled={updatesDisabled}
        />
      </View>
    )
  }

  return (
    <ModulaPopover
      isOpen={open}
      onOpen={() => setOpen(true)}
      onDismiss={() => setOpen(false)}
      width={220}
      accessibilityLabel={`Library, ${current}`}
      testID="product-hub-library-menu"
      triggerTestID="product-hub-library-trigger"
      trigger={
        <LiquidGlassChrome
          interactive
          fallback="regular"
          contentLayout="flow"
          style={{borderRadius: radius.round}}>
          <View style={[styles.trigger, {paddingHorizontal: spacing[3], gap: spacing[1]}]}>
            <AppText variant="buttonLabel" numberOfLines={1}>
              {current}
            </AppText>
            <ModulaIcon name="modules" size={14} colour={colours.text} />
          </View>
        </LiquidGlassChrome>
      }>
      <View style={{gap: spacing[1]}}>
        {LABELS.map(option => {
          const disabled = option.value === 'updates' && updatesDisabled
          const selected = option.value === value
          return (
            <AppPressable
              key={option.value}
              accessibilityLabel={option.label}
              accessibilityState={{disabled, selected}}
              disabled={disabled}
              onPress={() => {
                onChange(option.value)
                setOpen(false)
              }}
              style={[styles.item, {padding: spacing[3]}]}>
              <AppText
                variant="body"
                colour={selected ? 'accent' : disabled ? 'textTertiary' : 'text'}
                numberOfLines={1}>
                {option.label}
              </AppText>
            </AppPressable>
          )
        })}
      </View>
    </ModulaPopover>
  )
}

const styles = StyleSheet.create({
  item: {minHeight: 44, justifyContent: 'center'},
  trigger: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 36,
  },
})
