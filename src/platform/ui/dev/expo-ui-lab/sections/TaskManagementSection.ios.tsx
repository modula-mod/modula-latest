import {
  ContentUnavailableView,
  HStack,
  Picker,
  Section,
  Text,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui'
import {
  font,
  foregroundStyle,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers'

import {useExpoUiLab} from '@/platform/ui/dev/expo-ui-lab/LabContext'

function priorityColor(priority: string) {
  switch (priority) {
    case 'high':
      return 'red'
    case 'medium':
      return 'orange'
    case 'low':
      return 'green'
    default:
      return 'gray'
  }
}

export function TaskManagementSection() {
  const {tasks, toggleTask, taskFilter, setTaskFilter} = useExpoUiLab()
  const filterOptions = ['all', 'pending', 'completed'] as const

  const filteredTasks = tasks.filter(task => {
    if (taskFilter === 'all') return true
    if (taskFilter === 'pending') return !task.completed
    if (taskFilter === 'completed') return task.completed
    return true
  })

  return (
    <Section title="Task Management">
      <Picker
        label="Filter Tasks"
        selection={taskFilter}
        onSelectionChange={selection => {
          if (
            typeof selection === 'string' &&
            filterOptions.includes(selection as (typeof filterOptions)[number])
          ) {
            setTaskFilter(selection as (typeof filterOptions)[number])
          }
        }}
        modifiers={[pickerStyle('segmented')]}>
        {filterOptions.map(option => (
          <Text key={option} modifiers={[tag(option)]}>
            {option}
          </Text>
        ))}
      </Picker>

      {filteredTasks.length === 0 ? (
        <ContentUnavailableView
          title="No tasks found"
          systemImage="checkmark.circle"
          description={`No ${taskFilter} tasks at the moment`}
        />
      ) : (
        <VStack spacing={8}>
          {filteredTasks.map(task => (
            <HStack key={task.id} spacing={12} alignment="center">
              <Text modifiers={[font({size: 24})]}>{task.emoji}</Text>
              <VStack spacing={4} alignment="leading">
                <HStack spacing={8} alignment="center">
                  <Text
                    modifiers={[
                      font({size: 16}),
                      ...(task.completed ? [foregroundStyle('gray')] : []),
                    ]}>
                    {task.title}
                  </Text>
                  <Text
                    modifiers={[
                      font({size: 12}),
                      foregroundStyle(priorityColor(task.priority)),
                    ]}>
                    {task.priority.toUpperCase()}
                  </Text>
                </HStack>
                <Text modifiers={[font({size: 14}), foregroundStyle('gray')]}>
                  {task.description}
                </Text>
                <Text modifiers={[font({size: 12}), foregroundStyle('gray')]}>
                  {`Due: ${task.dueDate.toLocaleDateString()}`}
                </Text>
              </VStack>
              <Toggle
                isOn={task.completed}
                onIsOnChange={() => toggleTask(task.id)}
              />
            </HStack>
          ))}
        </VStack>
      )}
    </Section>
  )
}
