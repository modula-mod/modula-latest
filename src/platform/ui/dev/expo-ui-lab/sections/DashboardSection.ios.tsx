import {
  Button,
  Gauge,
  HStack,
  Section,
  Slider,
  Text,
  VStack,
} from '@expo/ui/swift-ui'
import {
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers'

import {useExpoUiLab} from '@/platform/ui/dev/expo-ui-lab/LabContext'

export function DashboardSection() {
  const {
    tasks,
    productivityScore,
    setProductivityScore,
    focusLevel,
    setFocusLevel,
  } = useExpoUiLab()

  const completedTasks = tasks.filter(t => t.completed).length
  const totalTasks = tasks.length
  const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0
  const highPriorityTasks = tasks.filter(
    t => t.priority === 'high' && !t.completed,
  ).length
  const urgentTasksRate = totalTasks > 0 ? highPriorityTasks / totalTasks : 0

  return (
    <Section title="Performance Dashboard">
      <VStack spacing={20}>
        <VStack spacing={12}>
          <Text modifiers={[font({size: 16, weight: 'semibold'})]}>
            Task Completion Metrics
          </Text>
          <HStack spacing={16}>
            <Gauge
              value={completionRate}
              modifiers={[
                frame({width: 100, height: 100}),
                gaugeStyle('circular'),
                tint('green'),
              ]}
              currentValueLabel={
                <Text>{`${Math.round(completionRate * 100)}%`}</Text>
              }>
              <Text>Done</Text>
            </Gauge>
            <VStack spacing={4} alignment="leading">
              <Text modifiers={[font({size: 14})]}>Completion Rate</Text>
              <Text modifiers={[font({size: 12}), foregroundStyle('gray')]}>
                {`${completedTasks} of ${totalTasks} completed`}
              </Text>
            </VStack>
          </HStack>
        </VStack>

        <VStack spacing={12}>
          <Text modifiers={[font({size: 16, weight: 'semibold'})]}>
            Gauge Component Variants
          </Text>
          <HStack spacing={16}>
            <VStack spacing={8} alignment="center">
              <Gauge
                value={productivityScore}
                modifiers={[
                  frame({width: 80, height: 80}),
                  gaugeStyle('circular'),
                  tint('blue'),
                ]}
                currentValueLabel={
                  <Text>{`${Math.round(productivityScore * 100)}%`}</Text>
                }
              />
              <Text modifiers={[font({size: 12})]}>Circular</Text>
            </VStack>
            <VStack spacing={8} alignment="center">
              <Gauge
                value={focusLevel}
                modifiers={[
                  frame({width: 80, height: 80}),
                  gaugeStyle('circularCapacity'),
                  tint('purple'),
                ]}
                currentValueLabel={
                  <Text>{`${Math.round(focusLevel * 100)}%`}</Text>
                }
              />
              <Text modifiers={[font({size: 12})]}>Capacity</Text>
            </VStack>
            <VStack spacing={8} alignment="center">
              <Gauge
                value={urgentTasksRate}
                modifiers={[
                  frame({width: 80, height: 80}),
                  gaugeStyle('circularCapacity'),
                  tint('red'),
                ]}
                currentValueLabel={<Text>{`${highPriorityTasks}`}</Text>}
              />
              <Text modifiers={[font({size: 12})]}>Urgent</Text>
            </VStack>
          </HStack>

          <VStack spacing={8}>
            <Text modifiers={[font({size: 14})]}>Linear gauges</Text>
            <Gauge
              value={completionRate}
              modifiers={[gaugeStyle('linear'), tint('green')]}
            />
            <Gauge
              value={productivityScore}
              modifiers={[gaugeStyle('linear'), tint('blue')]}
            />
            <Gauge
              value={focusLevel}
              modifiers={[gaugeStyle('linearCapacity'), tint('purple')]}
            />
          </VStack>
        </VStack>

        <VStack spacing={12}>
          <Text modifiers={[font({size: 16, weight: 'semibold'})]}>
            Interactive Controls
          </Text>
          <VStack spacing={8}>
            <HStack spacing={12} alignment="center">
              <Text modifiers={[font({size: 14})]}>Productivity:</Text>
              <Text modifiers={[font({size: 14}), foregroundStyle('blue')]}>
                {`${Math.round(productivityScore * 100)}%`}
              </Text>
            </HStack>
            <Slider
              value={productivityScore}
              onValueChange={setProductivityScore}
            />
          </VStack>
          <VStack spacing={8}>
            <HStack spacing={12} alignment="center">
              <Text modifiers={[font({size: 14})]}>Focus:</Text>
              <Text modifiers={[font({size: 14}), foregroundStyle('purple')]}>
                {`${Math.round(focusLevel * 100)}%`}
              </Text>
            </HStack>
            <Slider value={focusLevel} onValueChange={setFocusLevel} />
          </VStack>
        </VStack>

        <Button
          label="Randomize"
          systemImage="shuffle"
          onPress={() => {
            setProductivityScore(Math.random())
            setFocusLevel(Math.random())
          }}
        />
      </VStack>
    </Section>
  )
}
