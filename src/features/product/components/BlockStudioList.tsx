import {StyleSheet, Switch, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {
  moveOrderedId,
  toggleOrderedId,
  type LayoutBlock,
} from '@/features/product/data/layoutBlocks'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type BlockStudioListProps = {
  catalog: readonly LayoutBlock[]
  selectedIds: string[]
  onChange: (next: string[]) => void
}

/** Shared toggle + reorder list for Home / Discover / Tabs / Activity / Profile studios. */
export function BlockStudioList({catalog, selectedIds, onChange}: BlockStudioListProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const ordered = selectedIds
    .map(id => catalog.find(block => block.id === id))
    .filter((block): block is LayoutBlock => Boolean(block))
  const selected = new Set(selectedIds)

  return (
    <View style={{gap: spacing[4]}}>
      {ordered.length ? (
        <View style={{gap: spacing[2]}}>
          <AppText variant="headline">On this surface</AppText>
          {ordered.map((block, index) => (
            <Surface
              key={block.id}
              variant="contained"
              style={[
                styles.row,
                {
                  backgroundColor: colours.surface,
                  borderColor: colours.border,
                  borderRadius: radius.large,
                  gap: spacing[3],
                  padding: spacing[3],
                },
              ]}>
              <AppIcon name={block.icon} colour={colours.accent} />
              <View style={{flex: 1, gap: 2}}>
                <AppText variant="label">{block.label}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  #{index + 1}
                  {block.required ? ' · Required' : ''}
                </AppText>
              </View>
              <AppPressable
                accessibilityLabel={`Move ${block.label} up`}
                disabled={index === 0}
                onPress={() => {
                  void selectionHaptic()
                  onChange(moveOrderedId(selectedIds, block.id, -1))
                }}
                style={[styles.arrow, {opacity: index === 0 ? 0.35 : 1}]}>
                <AppIcon name="arrowUp" colour={colours.textSecondary} size={18} />
              </AppPressable>
              <AppPressable
                accessibilityLabel={`Move ${block.label} down`}
                disabled={index === ordered.length - 1}
                onPress={() => {
                  void selectionHaptic()
                  onChange(moveOrderedId(selectedIds, block.id, 1))
                }}
                style={[
                  styles.arrow,
                  {opacity: index === ordered.length - 1 ? 0.35 : 1},
                ]}>
                <AppIcon name="arrowDown" colour={colours.textSecondary} size={18} />
              </AppPressable>
            </Surface>
          ))}
        </View>
      ) : null}

      <View style={{gap: spacing[2]}}>
        <AppText variant="headline">Catalog</AppText>
        {catalog.map(block => {
          const on = selected.has(block.id)
          return (
            <Surface
              key={block.id}
              variant="contained"
              style={[
                styles.row,
                {
                  backgroundColor: on ? colours.accentSubtle : colours.surface,
                  borderColor: on ? colours.accentBorder : colours.border,
                  borderRadius: radius.large,
                  gap: spacing[3],
                  padding: spacing[3],
                },
              ]}>
              <AppIcon name={block.icon} colour={on ? colours.accent : colours.textSecondary} />
              <View style={{flex: 1, gap: 2}}>
                <AppText variant="label">{block.label}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {block.description}
                </AppText>
              </View>
              <Switch
                accessibilityLabel={`${on ? 'Hide' : 'Show'} ${block.label}`}
                disabled={Boolean(block.required)}
                value={on}
                onValueChange={() => {
                  void selectionHaptic()
                  onChange(toggleOrderedId(selectedIds, block.id, catalog))
                }}
              />
            </Surface>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  arrow: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 36,
  },
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
