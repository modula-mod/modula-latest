import {
  Button,
  ContextMenu,
  HStack,
  Picker,
  Section,
  Text,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui'
import {font, foregroundStyle, tag} from '@expo/ui/swift-ui/modifiers'

import {useExpoUiLab} from '@/platform/ui/dev/expo-ui-lab/LabContext'

/**
 * Nested menus use ContextMenu-as-submenu (Submenu is deprecated in SDK 57).
 */
export function ContextMenuSection() {
  const {contextMenuStates, updateContextMenuState, tasks, toggleTask, taskFilter, setTaskFilter} =
    useExpoUiLab()

  return (
    <Section title="Context Menu & Actions">
      <VStack spacing={16}>
        <Text modifiers={[font({size: 16, weight: 'semibold'})]}>
          Interactive Context Menu
        </Text>
        <Text modifiers={[font({size: 12}), foregroundStyle('gray')]}>
          Long-press the menu button for nested options, a tab picker, toggles,
          and destructive actions.
        </Text>

        <HStack spacing={16} alignment="center">
          <ContextMenu>
            <ContextMenu.Items>
              <Button
                systemImage="info.circle"
                label="Task Overview"
                onPress={() => undefined}
              />

              <Picker
                label="Jump to tab"
                systemImage="square.grid.2x2"
                selection={taskFilter}
                onSelectionChange={value => {
                  if (value === 'all' || value === 'pending' || value === 'completed') {
                    setTaskFilter(value)
                  }
                }}>
                <Text modifiers={[tag('all')]}>All</Text>
                <Text modifiers={[tag('pending')]}>Pending</Text>
                <Text modifiers={[tag('completed')]}>Completed</Text>
              </Picker>

              <ContextMenu>
                <ContextMenu.Trigger>
                  <Button
                    systemImage="line.3.horizontal.decrease.circle"
                    label="Filter Tasks"
                  />
                </ContextMenu.Trigger>
                <ContextMenu.Items>
                  <Button systemImage="list.bullet" label="Show All" />
                  <Button
                    systemImage="exclamationmark.triangle.fill"
                    label="High Priority Only"
                  />
                  <Button
                    systemImage="calendar.badge.clock"
                    label="Due Today"
                  />
                </ContextMenu.Items>
              </ContextMenu>

              <Toggle
                label="Show Completed Tasks"
                systemImage="checkmark.circle"
                isOn={contextMenuStates['Show Completed Tasks']}
                onIsOnChange={value =>
                  updateContextMenuState('Show Completed Tasks', value)
                }
              />

              <ContextMenu>
                <ContextMenu.Trigger>
                  <Button systemImage="eye" label="View Options" />
                </ContextMenu.Trigger>
                <ContextMenu.Items>
                  <Toggle
                    label="Auto Refresh"
                    systemImage="arrow.clockwise"
                    isOn={contextMenuStates['Auto Refresh']}
                    onIsOnChange={value =>
                      updateContextMenuState('Auto Refresh', value)
                    }
                  />
                  <Toggle
                    label="Notifications"
                    systemImage="bell"
                    isOn={contextMenuStates.Notifications}
                    onIsOnChange={value =>
                      updateContextMenuState('Notifications', value)
                    }
                  />
                  <ContextMenu>
                    <ContextMenu.Trigger>
                      <Button systemImage="gear" label="Advanced Settings" />
                    </ContextMenu.Trigger>
                    <ContextMenu.Items>
                      <Toggle
                        label="Dark Mode"
                        systemImage="moon.fill"
                        isOn={contextMenuStates['Dark Mode']}
                        onIsOnChange={value =>
                          updateContextMenuState('Dark Mode', value)
                        }
                      />
                      <Button
                        systemImage="arrow.clockwise.circle"
                        label="Reset All Settings"
                        role="destructive"
                      />
                      <Button
                        systemImage="square.and.arrow.up"
                        label="Export Data"
                      />
                    </ContextMenu.Items>
                  </ContextMenu>
                </ContextMenu.Items>
              </ContextMenu>

              <ContextMenu>
                <ContextMenu.Trigger>
                  <Button systemImage="bolt" label="Quick Actions" />
                </ContextMenu.Trigger>
                <ContextMenu.Items>
                  <Button
                    systemImage="checkmark.circle.fill"
                    label="Mark All Complete"
                    onPress={() => {
                      tasks
                        .filter(t => !t.completed)
                        .forEach(task => toggleTask(task.id))
                    }}
                  />
                  <Button
                    systemImage="trash"
                    label="Clear Completed"
                    role="destructive"
                  />
                </ContextMenu.Items>
              </ContextMenu>

              <Button
                systemImage="questionmark.circle"
                label="Help & Support"
              />
            </ContextMenu.Items>
            <ContextMenu.Trigger>
              <Button
                systemImage="ellipsis.circle.fill"
                label="Menu Options"
              />
            </ContextMenu.Trigger>
          </ContextMenu>

          <VStack spacing={4} alignment="leading">
            <Text modifiers={[font({size: 12}), foregroundStyle('gray')]}>
              Features:
            </Text>
            <Text modifiers={[font({size: 10}), foregroundStyle('gray')]}>
              · Tabs in menu (Picker)
            </Text>
            <Text modifiers={[font({size: 10}), foregroundStyle('gray')]}>
              · Nested submenus
            </Text>
            <Text modifiers={[font({size: 10}), foregroundStyle('gray')]}>
              · Toggle switches
            </Text>
            <Text modifiers={[font({size: 10}), foregroundStyle('gray')]}>
              · Destructive actions
            </Text>
            <Text modifiers={[font({size: 10}), foregroundStyle('gray')]}>
              · System icons
            </Text>
          </VStack>
        </HStack>
      </VStack>
    </Section>
  )
}
