import {ScrollView, StyleSheet, View} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type SelectionSheetOption<T extends string = string> = {
  id: T
  label: string
  description?: string
  icon?: AppIconName
  preview?: boolean
}

type SelectionSheetProps<T extends string> = {
  isPresented: boolean
  onDismiss: () => void
  title: string
  subtitle?: string
  options: SelectionSheetOption<T>[]
  selectedId: T
  onSelect: (id: T) => void
  testID?: string
  snapPoints?: ModulaSheetPropsSnap[]
}

type ModulaSheetPropsSnap = 'half' | 'full' | {fraction: number} | {height: number}

/** Reusable single-select list hosted in ModulaSheet (Expo BottomSheet on iOS). */
export function SelectionSheet<T extends string>({
  isPresented,
  onDismiss,
  title,
  subtitle,
  options,
  selectedId,
  onSelect,
  testID,
  snapPoints = ['half', 'full'],
}: SelectionSheetProps<T>) {
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <ModulaSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      snapPoints={snapPoints}
      testID={testID}>
      <ScrollView contentContainerStyle={{gap: spacing[3], paddingBottom: spacing[6]}}>
        <View style={{gap: spacing[1]}}>
          <AppText variant="headline">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" colour="textSecondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {options.map(option => {
          const selected = option.id === selectedId
          return (
            <AppPressable
              key={option.id}
              accessibilityLabel={`${option.label}${option.preview ? ' Preview' : ''}${selected ? ', selected' : ''}`}
              accessibilityRole="radio"
              accessibilityState={{selected}}
              onPress={() => {
                onSelect(option.id)
                onDismiss()
              }}
              style={[
                styles.row,
                {
                  backgroundColor: selected ? colours.accentSubtle : colours.surfaceRaised,
                  borderColor: selected ? colours.accent : colours.border,
                  borderRadius: radius.md,
                  gap: spacing[3],
                  padding: spacing[3],
                },
              ]}>
              {option.icon ? (
                <AppIcon
                  name={option.icon}
                  colour={selected ? colours.accent : colours.textSecondary}
                />
              ) : null}
              <View style={styles.textCol}>
                <AppText variant="label" style={{color: selected ? colours.accent : colours.text}}>
                  {option.label}
                  {option.preview ? ' — Preview' : ''}
                </AppText>
                {option.description ? (
                  <AppText variant="caption" colour="textSecondary">
                    {option.description}
                  </AppText>
                ) : null}
              </View>
              {selected ? <AppIcon name="check" colour={colours.accent} /> : null}
            </AppPressable>
          )
        })}
      </ScrollView>
    </ModulaSheet>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
  },
  textCol: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
})
