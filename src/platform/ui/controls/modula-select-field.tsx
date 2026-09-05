import {useState} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaSelectOption = {value: string; label: string}

export function ModulaSelectField({
  value,
  options,
  onChange,
  placeholder = 'Choose',
  accessibilityLabel,
  sheetTitle,
  loading = false,
  allowClear = true,
}: {
  value?: string
  options: ModulaSelectOption[]
  onChange: (value: string | undefined) => void
  placeholder?: string
  accessibilityLabel: string
  sheetTitle?: string
  loading?: boolean
  allowClear?: boolean
}) {
  const {colours, controls, radius, spacing} = useThemeTokens()
  const [isPresented, setIsPresented] = useState(false)
  const selected = options.find(option => option.value === value)
  const shown = loading ? 'Loading…' : selected?.label ?? (value || placeholder)

  return (
    <>
      <AppPressable
        accessibilityLabel={`${accessibilityLabel}, ${shown}`}
        accessibilityState={{expanded: isPresented}}
        disabled={loading}
        onPress={() => setIsPresented(true)}
        style={[
          styles.trigger,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.border,
            borderRadius: radius.medium,
            gap: spacing[2],
            minHeight: controls.inputHeight.singleLine,
            paddingHorizontal: spacing[4],
          },
        ]}>
        <AppText
          variant="body"
          colour={selected || value ? 'text' : 'textTertiary'}
          numberOfLines={1}
          style={styles.value}>
          {shown}
        </AppText>
        <ModulaIcon name="chevronRight" size={controls.iconSize.status} colour={colours.textTertiary} />
      </AppPressable>
      <ModulaSheet
        isPresented={isPresented}
        onDismiss={() => setIsPresented(false)}
        detent="medium"
        accessibilityLabel={sheetTitle ?? accessibilityLabel}
        header={<AppText variant="headline">{sheetTitle ?? accessibilityLabel}</AppText>}>
        <View style={[styles.options, {borderColor: colours.separator}]}>
          {allowClear ? (
            <SelectRow
              label="None"
              selected={!value}
              onPress={() => {
                onChange(undefined)
                setIsPresented(false)
              }}
            />
          ) : null}
          {options.map(option => (
            <SelectRow
              key={option.value}
              label={option.label}
              selected={option.value === value}
              onPress={() => {
                onChange(option.value)
                setIsPresented(false)
              }}
            />
          ))}
          {!loading && !options.length ? (
            <View style={[styles.empty, {minHeight: controls.listRow.minimum}]}>
              <AppText variant="caption" colour="textSecondary">
                No choices available.
              </AppText>
            </View>
          ) : null}
        </View>
      </ModulaSheet>
    </>
  )
}

function SelectRow({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const {colours, controls, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{checked: selected}}
      onPress={onPress}
      style={[
        styles.option,
        {
          borderBottomColor: colours.separator,
          gap: spacing[3],
          minHeight: controls.listRow.minimum,
          paddingHorizontal: spacing[2],
        },
      ]}>
      <AppText variant="body" style={styles.value}>{label}</AppText>
      {selected ? <ModulaIcon name="check" size={controls.iconSize.row} colour={colours.accent} /> : null}
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  empty: {justifyContent: 'center'},
  option: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  options: {borderTopWidth: StyleSheet.hairlineWidth},
  trigger: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  value: {flex: 1, minWidth: 0},
})
