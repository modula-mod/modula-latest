import {useEffect, useState} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const STORAGE_KEY = 'modula.kaizen.queue.v1'

type KaizenItem = {
  id: string
  componentId: string
  description: string
  classifications: string[]
  createdAt: string
}

const CLASSIFICATIONS = [
  'bug',
  'visual',
  'copy',
  'accessibility',
  'performance',
  'workflow',
  'intelligence',
  'trust-safety',
]

function parseQueue(raw: string | null): KaizenItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is KaizenItem =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.componentId === 'string' &&
        typeof item.description === 'string' &&
        Array.isArray(item.classifications) &&
        item.classifications.every((value: unknown) => typeof value === 'string') &&
        typeof item.createdAt === 'string',
    )
  } catch {
    return []
  }
}

export function KaizenScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [componentId, setComponentId] = useState('product.chat-assist')
  const [description, setDescription] = useState('')
  const [classifications, setClassifications] = useState<string[]>(['workflow'])
  const [queue, setQueue] = useState<KaizenItem[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    void AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (mounted) setQueue(parseQueue(raw))
    })
    return () => {
      mounted = false
    }
  }, [])

  const saveQueue = (next: KaizenItem[]) => {
    setQueue(next)
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const submit = () => {
    const cleanComponentId = componentId.trim()
    const cleanDescription = description.trim()
    if (!cleanComponentId || !cleanDescription) {
      setMessage('Add a component id and description before queueing an improvement.')
      return
    }
    const item: KaizenItem = {
      id: `kaizen-${Date.now()}`,
      componentId: cleanComponentId,
      description: cleanDescription,
      classifications: classifications.length ? classifications : ['workflow'],
      createdAt: new Date().toISOString(),
    }
    saveQueue([item, ...queue])
    setDescription('')
    setMessage('Queued locally for review. No code was rewritten or deployed.')
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Kaizen" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="caption" colour="accent">
              IMPROVE QUEUE / LOCAL REVIEW
            </AppText>
            <AppText variant="display">Capture improvements without pretending to ship them.</AppText>
            <AppText variant="body" colour="textSecondary">
              Kaizen records feedback into a local review queue. This Preview does not silently
              rewrite production code, trigger agents, or deploy changes.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                backgroundColor: colours.surface,
                borderColor: colours.border,
                borderRadius: radius.large,
                padding: spacing[4],
                gap: spacing[3],
              },
            ]}>
            <AppText variant="headline">Capture improvement</AppText>
            <TextInput
              value={componentId}
              onChangeText={setComponentId}
              accessibilityLabel="Component id"
              placeholder="component id, e.g. product.start.launcher"
              placeholderTextColor={colours.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: colours.surfaceRaised,
                  borderColor: colours.border,
                  borderRadius: radius.medium,
                  color: colours.text,
                  paddingHorizontal: spacing[3],
                },
              ]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              accessibilityLabel="Improvement description"
              placeholder="What should improve?"
              placeholderTextColor={colours.textTertiary}
              multiline
              textAlignVertical="top"
              style={[
                styles.descriptionInput,
                {
                  backgroundColor: colours.surfaceRaised,
                  borderColor: colours.border,
                  borderRadius: radius.medium,
                  color: colours.text,
                  padding: spacing[3],
                },
              ]}
            />
            <View style={[styles.chips, {gap: spacing[2]}]}>
              {CLASSIFICATIONS.map(label => {
                const selected = classifications.includes(label)
                return (
                  <AppPressable
                    key={label}
                    accessibilityLabel={`Classify as ${label}`}
                    accessibilityState={{selected}}
                    onPress={() => {
                      setClassifications(prev =>
                        selected ? prev.filter(item => item !== label) : [...prev, label],
                      )
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colours.accentSubtle : colours.surfaceRaised,
                        borderColor: selected ? colours.accent : colours.border,
                        borderRadius: radius.round,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                      },
                    ]}>
                    <AppText variant="caption" colour={selected ? 'accent' : 'textSecondary'}>
                      {label}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
            <AppButton onPress={submit}>Submit to local review queue</AppButton>
            {message ? (
              <AppText variant="caption" colour="textSecondary">
                {message}
              </AppText>
            ) : null}
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Review queue</AppText>
            {queue.length ? (
              queue.map(item => (
                <Surface
                  key={item.id}
                  variant="contained"
                  style={[
                    styles.queueCard,
                    {
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                      borderRadius: radius.medium,
                      padding: spacing[4],
                      gap: spacing[2],
                    },
                  ]}>
                  <View style={[styles.titleRow, {gap: spacing[2]}]}>
                    <AppIcon name="motion" colour={colours.accent} />
                    <AppText variant="headline" style={{flex: 1}}>
                      {item.componentId}
                    </AppText>
                  </View>
                  <AppText variant="body" colour="textSecondary">
                    {item.description}
                  </AppText>
                  <AppText variant="caption" colour="textTertiary">
                    {item.classifications.join(' / ')} / {new Date(item.createdAt).toLocaleString()}
                  </AppText>
                </Surface>
              ))
            ) : (
              <Surface
                variant="contained"
                style={[
                  styles.queueCard,
                  {
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                    borderRadius: radius.medium,
                    padding: spacing[4],
                  },
                ]}>
                <AppText variant="body" colour="textSecondary">
                  No local improvement reports yet.
                </AppText>
              </Surface>
            )}
          </View>

          <AppButton onPress={() => router.push('/product/intelligence' as Href)}>
            Intelligence Hub
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  input: {borderWidth: StyleSheet.hairlineWidth, minHeight: 44},
  descriptionInput: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 96,
  },
  chips: {flexDirection: 'row', flexWrap: 'wrap'},
  chip: {borderWidth: StyleSheet.hairlineWidth},
  queueCard: {borderWidth: StyleSheet.hairlineWidth},
  titleRow: {alignItems: 'center', flexDirection: 'row'},
})
