import {View} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {ModulaListRow} from '@/platform/ui/lists'
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
  const {colours, spacing} = useThemeTokens()

  return (
    <ModulaSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      presentation="picker"
      snapPoints={snapPoints}
      subtitle={subtitle}
      testID={testID}
      title={title}>
      <View style={{paddingBottom: spacing[6]}}>
        {options.map(option => {
          const selected = option.id === selectedId
          return (
            <ModulaListRow
              key={option.id}
              accessibilityLabel={`${option.label}${option.preview ? ' Preview' : ''}${selected ? ', selected' : ''}`}
              accessibilityRole="radio"
              accessibilityState={{selected}}
              accessory="check"
              last={option.id === options.at(-1)?.id}
              leading={option.icon ? (
                <AppIcon
                  name={option.icon}
                  colour={selected ? colours.accent : colours.textSecondary}
                />
              ) : undefined}
              onPress={() => {
                onSelect(option.id)
                onDismiss()
              }}
              selected={selected}
              title={`${option.label}${option.preview ? ' — Preview' : ''}`}
              description={option.description}
              variant="action"
            />
          )
        })}
      </View>
    </ModulaSheet>
  )
}
