import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons/modula-icon'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'
import {ModulaListRow, ModulaSeparator} from '@/platform/ui/lists'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaActionSheetProps = {
  isPresented: boolean
  onDismiss: () => void
  title?: string
  subtitle?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  testID?: string
}

/** Compact, native-feeling action sheet for share/save/report/context actions. */
export function ModulaActionSheet({
  isPresented,
  onDismiss,
  title,
  subtitle,
  actions,
  onAction,
  testID,
}: ModulaActionSheetProps) {
  const {colours} = useThemeTokens()
  return (
    <ModulaSheet
      detents={['content', 'medium']}
      isPresented={isPresented}
      onDismiss={onDismiss}
      presentation="compact"
      scrollBody={false}
      subtitle={subtitle}
      testID={testID}
      title={title}>
      <View>
        {actions.map((action, index) => {
          const destructive = action.style === 'destructive'
          return (
            <View key={action.id}>
              {destructive && index > 0 ? <ModulaSeparator section /> : null}
              <ModulaListRow
                accessibilityLabel={action.accessibilityLabel ?? action.label}
                accessory="none"
                disabled={action.disabled}
                last={index === actions.length - 1}
                leading={
                  action.icon ? (
                    <ModulaIcon
                      colour={destructive ? colours.destructive : colours.textSecondary}
                      name={action.icon}
                      size={20}
                    />
                  ) : null
                }
                onPress={() => {
                  onAction(action.id)
                  onDismiss()
                }}
                title={action.label}
                variant={destructive ? 'destructive' : 'action'}
              />
            </View>
          )
        })}
      </View>
    </ModulaSheet>
  )
}

export type ModulaToolDrawerItem = {
  id: string
  label: string
  icon: ModulaIconName
  disabled?: boolean
  badge?: string
  onPress: () => void
}

export type ModulaToolDrawerSection = {
  id: string
  title?: string
  tools: ModulaToolDrawerItem[]
}

/** Extension-ready tool drawer. Products contribute semantic tool records. */
export function ModulaToolDrawer({
  isPresented,
  onDismiss,
  sections,
  title = 'Tools',
  testID,
}: {
  isPresented: boolean
  onDismiss: () => void
  sections: ModulaToolDrawerSection[]
  title?: string
  testID?: string
}) {
  const {colours, controls, radius, spacing} = useThemeTokens()
  return (
    <ModulaSheet
      detents={['medium', 'large']}
      isPresented={isPresented}
      onDismiss={onDismiss}
      presentation="tools"
      testID={testID}
      title={title}>
      <View style={{gap: spacing[5]}}>
        {sections.map(section => (
          <View key={section.id} style={{gap: spacing[2]}}>
            {section.title ? (
              <AppText variant="sectionHeader" colour="textSecondary">
                {section.title}
              </AppText>
            ) : null}
            <View style={[styles.toolGrid, {gap: spacing[2]}]}>
              {section.tools.map(tool => (
                <AppPressable
                  accessibilityLabel={tool.label}
                  accessibilityRole="button"
                  accessibilityState={{disabled: tool.disabled}}
                  disabled={tool.disabled}
                  key={tool.id}
                  onPress={() => {
                    tool.onPress()
                    onDismiss()
                  }}
                  style={[
                    styles.tool,
                    {
                      backgroundColor: colours.surfaceRaised,
                      borderColor: colours.border,
                      borderRadius: radius.medium,
                      gap: spacing[2],
                      minHeight: controls.listRow.comfortable,
                      opacity: tool.disabled ? 0.45 : 1,
                      padding: spacing[3],
                    },
                  ]}>
                  <ModulaIcon name={tool.icon} size={22} colour={colours.accent} />
                  <AppText variant="caption" numberOfLines={2} style={styles.toolLabel}>
                    {tool.label}
                  </AppText>
                  {tool.badge ? (
                    <AppText variant="metadata" colour="textSecondary">
                      {tool.badge}
                    </AppText>
                  ) : null}
                </AppPressable>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ModulaSheet>
  )
}

const styles = StyleSheet.create({
  tool: {
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '30%',
    flexGrow: 1,
    maxWidth: '48%',
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  toolLabel: {
    fontWeight: '600',
  },
})
