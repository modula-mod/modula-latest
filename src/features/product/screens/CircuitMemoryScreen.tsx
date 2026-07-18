import {useEffect, useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
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

const STORAGE_KEY = 'modula.circuit-memory.items.v1'

type MemoryLevel = 'session' | 'workspace' | 'user' | 'module' | 'validated' | 'system'

type MemoryItem = {
  id: string
  level: MemoryLevel
  title: string
  summary: string
  source: string
  updatedAt: string
}

const SEED_ITEMS: MemoryItem[] = [
  {
    id: 'mem-session-focus',
    level: 'session',
    title: 'Current Focus context',
    summary: 'Deep Focus suppresses unsolicited GAIA prompts and holds non-urgent send drafts.',
    source: 'FocusPolicyEngine Preview',
    updatedAt: '2026-07-18',
  },
  {
    id: 'mem-user-board',
    level: 'user',
    title: 'Morning Board preference',
    summary: 'Prefer tasks, calendar, and notes above social widgets when work mode is active.',
    source: 'Local product preference seed',
    updatedAt: '2026-07-18',
  },
  {
    id: 'mem-module-task',
    level: 'module',
    title: 'Task creation defaults',
    summary: 'Chat-to-task drafts require a visible preview and user confirmation before storage.',
    source: 'Command Layer Preview',
    updatedAt: '2026-07-18',
  },
]

function isMemoryLevel(value: unknown): value is MemoryLevel {
  return (
    value === 'session' ||
    value === 'workspace' ||
    value === 'user' ||
    value === 'module' ||
    value === 'validated' ||
    value === 'system'
  )
}

function parseItems(raw: string | null): MemoryItem[] {
  if (!raw) return SEED_ITEMS
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return SEED_ITEMS
    const items = parsed.filter(
      (item): item is MemoryItem =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        isMemoryLevel(item.level) &&
        typeof item.title === 'string' &&
        typeof item.summary === 'string' &&
        typeof item.source === 'string' &&
        typeof item.updatedAt === 'string',
    )
    return items.length ? items : SEED_ITEMS
  } catch {
    return SEED_ITEMS
  }
}

export function CircuitMemoryScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [items, setItems] = useState<MemoryItem[]>(SEED_ITEMS)
  const [selectedId, setSelectedId] = useState(SEED_ITEMS[0]?.id ?? '')
  const [exportText, setExportText] = useState('')

  useEffect(() => {
    let mounted = true
    void AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      const next = parseItems(raw)
      if (!mounted) return
      setItems(next)
      setSelectedId(next[0]?.id ?? '')
      if (!raw) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    })
    return () => {
      mounted = false
    }
  }, [])

  const selectedItem = useMemo(
    () => items.find(item => item.id === selectedId) ?? items[0],
    [items, selectedId],
  )

  const deleteItem = (id: string) => {
    const next = items.filter(item => item.id !== id)
    setItems(next)
    setSelectedId(next[0]?.id ?? '')
    setExportText('')
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Circuit Memory" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="caption" colour="accent">
              MEMORY CENTRE / LOCAL PREVIEW
            </AppText>
            <AppText variant="display">Inspect what the Preview remembers.</AppText>
            <AppText variant="body" colour="textSecondary">
              Circuit Memory is represented here as a local AsyncStorage list. There is no global
              memory, no cloud sync, and no hidden conversation retention in this build.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.note,
              {
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
                borderRadius: radius.medium,
                padding: spacing[4],
                gap: spacing[2],
              },
            ]}>
            <AppText variant="label">Honesty boundary</AppText>
            <AppText variant="caption" colour="textSecondary">
              Levels model session, workspace, user, module, validated, and system scopes. They are
              explanatory labels only until encrypted namespaces ship.
            </AppText>
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Memory items</AppText>
            {items.map(item => {
              const selected = selectedItem?.id === item.id
              return (
                <AppPressable
                  key={item.id}
                  accessibilityLabel={`Inspect ${item.title}`}
                  accessibilityState={{selected}}
                  onPress={() => {
                    setSelectedId(item.id)
                    setExportText('')
                  }}
                  style={[
                    styles.memoryRow,
                    {
                      backgroundColor: selected ? colours.accentSubtle : colours.surface,
                      borderColor: selected ? colours.accent : colours.border,
                      borderRadius: radius.medium,
                      padding: spacing[3],
                      gap: spacing[3],
                    },
                  ]}>
                  <AppIcon name="saved" colour={colours.accent} />
                  <View style={{flex: 1, gap: spacing[1]}}>
                    <AppText variant="headline">{item.title}</AppText>
                    <AppText variant="caption" colour="accent">
                      {item.level}
                    </AppText>
                    <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
                      {item.summary}
                    </AppText>
                  </View>
                </AppPressable>
              )
            })}
          </View>

          {selectedItem ? (
            <Surface
              variant="contained"
              style={[
                styles.card,
                {
                  backgroundColor: colours.surface,
                  borderColor: colours.border,
                  borderRadius: radius.large,
                  padding: spacing[4],
                  gap: spacing[2],
                },
              ]}>
              <AppText variant="caption" colour="accent">
                INSPECT
              </AppText>
              <AppText variant="headline">{selectedItem.title}</AppText>
              <AppText variant="body" colour="textSecondary">
                {selectedItem.summary}
              </AppText>
              <AppText variant="caption" colour="textTertiary">
                Level / {selectedItem.level} / Source / {selectedItem.source} / Updated /{' '}
                {selectedItem.updatedAt}
              </AppText>
              <View style={[styles.actions, {gap: spacing[2]}]}>
                <AppButton
                  variant="secondary"
                  onPress={() => setExportText(JSON.stringify(selectedItem, null, 2))}
                  style={styles.actionButton}>
                  Export JSON
                </AppButton>
                <AppButton
                  variant="ghost"
                  onPress={() => deleteItem(selectedItem.id)}
                  style={styles.actionButton}>
                  Delete local item
                </AppButton>
              </View>
            </Surface>
          ) : null}

          {exportText ? (
            <Surface
              variant="contained"
              style={[
                styles.exportCard,
                {
                  backgroundColor: colours.surfaceRaised,
                  borderColor: colours.border,
                  borderRadius: radius.medium,
                  padding: spacing[4],
                  gap: spacing[2],
                },
              ]}>
              <AppText variant="label">Export text</AppText>
              <AppText variant="caption" colour="textSecondary">
                This is JSON text shown on device, not a cloud export.
              </AppText>
              <AppText variant="caption" colour="textSecondary">
                {exportText}
              </AppText>
            </Surface>
          ) : null}

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
  note: {borderWidth: StyleSheet.hairlineWidth},
  memoryRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  card: {borderWidth: StyleSheet.hairlineWidth},
  actions: {flexDirection: 'row', flexWrap: 'wrap'},
  actionButton: {flexGrow: 1},
  exportCard: {borderWidth: StyleSheet.hairlineWidth},
})
