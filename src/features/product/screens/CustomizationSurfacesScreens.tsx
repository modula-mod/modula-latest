import {useMemo, useState, type ReactNode} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Pill} from '@/components/primitives/Pill'
import {Surface} from '@/components/primitives/Surface'
import {seededInnerCircle, seededLists} from '@/features/social/data/seededSurfaces'
import {PRESENCE_RAIL_SEED} from '@/features/presence/data/presenceRailSeed'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import type {
  ChromeDensity,
  MotionDensity,
  SurfacePreviewId,
} from '@/features/product/data/layoutBlocks'
import {selectionHaptic} from '@/lib/haptics'
import {StackedAvatars} from '@/platform/ui/avatars'
import {PresenceStoriesRail} from '@/features/presence/components/PresenceStoriesRail'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function PreviewBanner({text}: {text: string}) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <View
      style={{
        backgroundColor: colours.accentSubtle,
        borderColor: colours.accentBorder,
        borderRadius: radius.large,
        borderWidth: StyleSheet.hairlineWidth,
        padding: spacing[3],
      }}>
      <AppText variant="caption" colour="accent">
        {text}
      </AppText>
    </View>
  )
}

function SurfaceShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const {colours, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={title} />
      <ResponsiveContent maxWidth={720}>
        <ScrollView
          contentContainerStyle={{
            gap: spacing[4],
            padding: spacing[4],
            paddingBottom: tabPadding,
          }}>
          {children}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

export function StatusComposerScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [status, setStatus] = useState('')
  const [audience, setAudience] = useState<'halo' | 'inner' | 'public'>('halo')

  return (
    <SurfaceShell title="Status">
      <PreviewBanner text="Status Composer Preview — local only; nothing is published remotely." />
      <AppText variant="display">What’s your presence?</AppText>
      <View
        style={[
          styles.inputCard,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.border,
            borderRadius: radius.xlarge,
            padding: spacing[4],
          },
        ]}>
        <TextInput
          value={status}
          onChangeText={setStatus}
          placeholder="Focusing · building · offline for deep work…"
          placeholderTextColor={colours.textTertiary}
          multiline
          style={{color: colours.text, fontSize: 18, minHeight: 88}}
        />
      </View>
      <View style={{flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap'}}>
        {(
          [
            ['halo', 'Focus Halo'],
            ['inner', 'Inner Circle'],
            ['public', 'Public'],
          ] as const
        ).map(([id, label]) => (
          <Pill
            key={id}
            label={label}
            selected={audience === id}
            onPress={() => {
              void selectionHaptic()
              setAudience(id)
            }}
          />
        ))}
      </View>
      <AppButton
        onPress={() => {
          void selectionHaptic()
          router.back()
        }}>
        Save status — Preview
      </AppButton>
    </SurfaceShell>
  )
}

export function SavedHubScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const links: {label: string; href: Href; icon: AppIconName; blurb: string}[] = [
    {label: 'Saved posts', href: '/saved' as Href, icon: 'bookmark', blurb: 'Bookmarks list'},
    {
      label: 'Collections',
      href: '/collections' as Href,
      icon: 'board',
      blurb: 'Grouped saves',
    },
    {label: 'Drafts', href: '/drafts' as Href, icon: 'text', blurb: 'Composer drafts'},
    {label: 'Lists', href: '/lists' as Href, icon: 'people', blurb: 'People lists'},
  ]

  return (
    <SurfaceShell title="Saved hub">
      <PreviewBanner text="Unified Saved Hub Preview — routes into existing local surfaces." />
      <AppText variant="display">Everything you kept</AppText>
      {links.map(link => (
        <AppPressable key={link.label} onPress={() => router.push(link.href)}>
          <Surface
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
            <AppIcon name={link.icon} colour={colours.accent} />
            <View style={{flex: 1}}>
              <AppText variant="label">{link.label}</AppText>
              <AppText variant="caption" colour="textSecondary">
                {link.blurb}
              </AppText>
            </View>
            <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
          </Surface>
        </AppPressable>
      ))}
    </SurfaceShell>
  )
}

export function QuietInboxScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const bundles = [
    {id: '1', title: '3 replies · Focus Halo', detail: 'Bundled while Light Focus is on'},
    {id: '2', title: 'Module updates', detail: '2 Marketplace Previews waiting'},
    {id: '3', title: 'Mentions', detail: 'Delivered · not suppressed'},
  ]

  return (
    <SurfaceShell title="Quiet inbox">
      <PreviewBanner text="Focus-aware digest Preview — pairs with Activity digest strip." />
      <AppText variant="display">Low-noise notifications</AppText>
      {bundles.map((item, index) => (
        <SectionEnter key={item.id} delay={index * 40}>
          <Surface
            variant="contained"
            style={{
              backgroundColor: colours.surface,
              borderColor: colours.border,
              borderRadius: radius.large,
              borderWidth: StyleSheet.hairlineWidth,
              gap: spacing[1],
              padding: spacing[3],
            }}>
            <AppText variant="label">{item.title}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {item.detail}
            </AppText>
          </Surface>
        </SectionEnter>
      ))}
      <AppButton onPress={() => router.push('/activity' as Href)}>Open full Activity</AppButton>
      <AppButton variant="secondary" onPress={() => router.push('/product/focus' as Href)}>
        Focus Mode
      </AppButton>
    </SurfaceShell>
  )
}

export function InnerCircleScreen() {
  const router = useRouter()
  const faces = seededInnerCircle.map((person, index) => ({
    id: person.id,
    name: person.name,
    colour: ['#369CAA', '#2A6F78', '#4A6670', '#5C7A84'][index % 4],
  }))

  return (
    <SurfaceShell title="Inner Circle">
      <PreviewBanner text="Inner Circle Preview — priority people, not a separate social network." />
      <PresenceStoriesRail
        people={PRESENCE_RAIL_SEED.filter(person => person.id !== 'you').slice(0, 5)}
        compact
        showCaption={false}
      />
      <StackedAvatars faces={faces} size={40} max={5} />
      <AppText variant="body" colour="textSecondary">
        Manage who appears in Focus Halo priority and Quiet Inbox allowlists.
      </AppText>
      <AppButton onPress={() => router.push('/settings/inner-circle' as Href)}>
        Inner Circle settings
      </AppButton>
    </SurfaceShell>
  )
}

export function ShareDestinationsScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const destinations = [
    {id: 'people', label: 'People', icon: 'people' as const},
    {id: 'lists', label: 'Lists', icon: 'people' as const},
    {id: 'communities', label: 'Communities', icon: 'community' as const},
    {id: 'modules', label: 'Modules', icon: 'modules' as const},
    {id: 'board', label: 'Board card', icon: 'board' as const},
  ]
  const [selected, setSelected] = useState('people')

  return (
    <SurfaceShell title="Share destinations">
      <PreviewBanner text="Share sheet destinations Preview — pick default targets." />
      {destinations.map(item => {
        const on = selected === item.id
        return (
          <AppPressable
            key={item.id}
            onPress={() => {
              void selectionHaptic()
              setSelected(item.id)
            }}>
            <Surface
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
              <AppIcon name={item.icon} colour={on ? colours.accent : colours.textSecondary} />
              <AppText variant="label" style={{flex: 1}}>
                {item.label}
              </AppText>
              {on ? <AppIcon name="check" colour={colours.accent} /> : null}
            </Surface>
          </AppPressable>
        )
      })}
      <AppText variant="caption" colour="textSecondary">
        Lists available: {seededLists.length} local Previews
      </AppText>
    </SurfaceShell>
  )
}

export function ScheduledPostsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const items = [
    {id: '1', when: 'Tomorrow · 09:00', body: 'Phase notes for Builders community'},
    {id: '2', when: 'Fri · 18:30', body: 'Module vault walkthrough clip'},
  ]

  return (
    <SurfaceShell title="Scheduled">
      <PreviewBanner text="Scheduled Posts Preview — queue only; Command Layer publish later." />
      {items.map(item => (
        <Surface
          key={item.id}
          variant="contained"
          style={{
            backgroundColor: colours.surface,
            borderColor: colours.border,
            borderRadius: radius.large,
            borderWidth: StyleSheet.hairlineWidth,
            gap: spacing[1],
            padding: spacing[3],
          }}>
          <AppText variant="caption" colour="accent">
            {item.when}
          </AppText>
          <AppText variant="body">{item.body}</AppText>
        </Surface>
      ))}
      <AppButton onPress={() => router.push('/compose' as Href)}>Open Composer</AppButton>
    </SurfaceShell>
  )
}

export function ReactionsPrefsScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const set = ['👍', '❤️', '🔥', '✨', '👏', '🙌']
  const [active, setActive] = useState(set.slice(0, 4))

  return (
    <SurfaceShell title="Reactions">
      <PreviewBanner text="Reactions prefs Preview — local palette for the reaction control." />
      <AppText variant="headline">Your tray</AppText>
      <View style={{flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap'}}>
        {set.map(emoji => {
          const on = active.includes(emoji)
          return (
            <AppPressable
              key={emoji}
              onPress={() => {
                void selectionHaptic()
                setActive(prev =>
                  on ? prev.filter(item => item !== emoji) : [...prev, emoji].slice(0, 6),
                )
              }}
              style={[
                styles.emoji,
                {
                  backgroundColor: on ? colours.accentSubtle : colours.surfaceRaised,
                  borderColor: on ? colours.accent : colours.border,
                  borderRadius: radius.round,
                },
              ]}>
              <AppText variant="title">{emoji}</AppText>
            </AppPressable>
          )
        })}
      </View>
    </SurfaceShell>
  )
}

export function DayAgendaScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const blocks = [
    {time: '09:00', title: 'Focus block', meta: 'Deep Focus · Quiet Feed'},
    {time: '11:30', title: 'Module review', meta: 'Board · Marketplace'},
    {time: '15:00', title: 'Presence office hours', meta: 'Live Presence Preview'},
  ]

  return (
    <SurfaceShell title="Day agenda">
      <PreviewBanner text="Day Agenda Preview — calendar belongs in a module, not host chrome." />
      {blocks.map(block => (
        <Surface
          key={block.time}
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
          <AppText variant="label" colour="accent">
            {block.time}
          </AppText>
          <View style={{flex: 1}}>
            <AppText variant="label">{block.title}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {block.meta}
            </AppText>
          </View>
        </Surface>
      ))}
    </SurfaceShell>
  )
}

export function AutomationsInboxScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const rows = [
    {id: '1', title: 'Needs approval', detail: 'Draft → Board pin', accent: true},
    {id: '2', title: 'Failed run', detail: 'Notify Inner Circle · retry Preview', accent: false},
    {id: '3', title: 'Completed', detail: 'Quiet Send applied', accent: false},
  ]

  return (
    <SurfaceShell title="Automations inbox">
      <PreviewBanner text="Automations inbox Preview — approvals without a remote runner." />
      {rows.map(row => (
        <Surface
          key={row.id}
          variant="contained"
          style={{
            backgroundColor: colours.surface,
            borderColor: colours.border,
            borderRadius: radius.large,
            borderWidth: StyleSheet.hairlineWidth,
            gap: spacing[1],
            padding: spacing[3],
          }}>
          <AppText variant="label" colour={row.accent ? 'accent' : 'text'}>
            {row.title}
          </AppText>
          <AppText variant="caption" colour="textSecondary">
            {row.detail}
          </AppText>
        </Surface>
      ))}
      <AppButton onPress={() => router.push('/product/automations' as Href)}>
        Automations studio
      </AppButton>
    </SurfaceShell>
  )
}

export function CommandsPaletteScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [query, setQuery] = useState('')
  const commands = useMemo(
    () =>
      [
        {id: 'compose', label: 'composer.new', href: '/compose' as Href},
        {id: 'focus', label: 'focus.set', href: '/product/focus' as Href},
        {id: 'search', label: 'search.open', href: '/product/search' as Href},
        {id: 'customize', label: 'shell.customize', href: '/product/customize' as Href},
        {id: 'commands', label: 'commands.layer', href: '/product/commands' as Href},
      ].filter(item => item.label.includes(query.trim().toLowerCase()) || !query.trim()),
    [query],
  )

  return (
    <SurfaceShell title="Commands">
      <PreviewBanner text="Commands palette Preview — browse typed commands; risk gates stay on Commands Layer." />
      <View
        style={[
          styles.inputCard,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.border,
            borderRadius: radius.round,
            paddingHorizontal: spacing[4],
          },
        ]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Filter commands…"
          placeholderTextColor={colours.textTertiary}
          style={{color: colours.text, minHeight: 44, fontSize: 16}}
        />
      </View>
      {commands.map(command => (
        <AppPressable key={command.id} onPress={() => router.push(command.href)}>
          <Surface
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
            <AppIcon name="tools" colour={colours.accent} />
            <AppText variant="label" style={{flex: 1}}>
              {command.label}
            </AppText>
            <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
          </Surface>
        </AppPressable>
      ))}
    </SurfaceShell>
  )
}

export function MotionPrefsScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const options: {id: MotionDensity; label: string; detail: string}[] = [
    {id: 'full', label: 'Full', detail: 'Section enters, presence pulse, tray springs'},
    {id: 'reduced', label: 'Reduced', detail: 'Shorter fades; no pulses'},
    {id: 'minimal', label: 'Minimal', detail: 'Near-instant; still respects OS Reduce Motion'},
  ]

  return (
    <SurfaceShell title="Motion">
      <PreviewBanner text="Motion density persists locally. OS Reduce Motion always wins." />
      {options.map(option => {
        const on = preferences.motionDensity === option.id
        return (
          <AppPressable
            key={option.id}
            onPress={() => {
              void selectionHaptic()
              void update({motionDensity: option.id})
            }}>
            <Surface
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
              <View style={{flex: 1, gap: 2}}>
                <AppText variant="label">{option.label}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {option.detail}
                </AppText>
              </View>
              {on ? <AppIcon name="check" colour={colours.accent} /> : null}
            </Surface>
          </AppPressable>
        )
      })}
    </SurfaceShell>
  )
}

export function ChromeDensityScreen() {
  const {colours, radius} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const options: {id: ChromeDensity; label: string; pad: number}[] = [
    {id: 'compact', label: 'Compact', pad: 8},
    {id: 'comfortable', label: 'Comfortable', pad: 14},
    {id: 'airy', label: 'Airy', pad: 20},
  ]

  return (
    <SurfaceShell title="Chrome density">
      <PreviewBanner text="Chrome density is live for floating tab bar content insets across the shell." />
      {options.map(option => {
        const on = preferences.chromeDensity === option.id
        return (
          <AppPressable
            key={option.id}
            onPress={() => {
              void selectionHaptic()
              void update({chromeDensity: option.id})
            }}>
            <Surface
              variant="contained"
              style={{
                backgroundColor: on ? colours.accentSubtle : colours.surface,
                borderColor: on ? colours.accentBorder : colours.border,
                borderRadius: radius.large,
                borderWidth: StyleSheet.hairlineWidth,
                padding: option.pad,
                gap: 6,
              }}>
              <AppText variant="label">{option.label}</AppText>
              <AppText variant="caption" colour="textSecondary">
                Padding sample · {option.pad}pt
              </AppText>
            </Surface>
          </AppPressable>
        )
      })}
    </SurfaceShell>
  )
}

export function SurfacePlaygroundScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const options: {id: SurfacePreviewId; label: string; detail: string}[] = [
    {id: 'solid', label: 'Solid', detail: 'Opaque raised surfaces'},
    {id: 'glass', label: 'Glass', detail: 'Blur / liquid glass chrome'},
    {id: 'minimal', label: 'Minimal', detail: 'Hairlines, less fill'},
  ]

  return (
    <SurfaceShell title="Surface Type">
      <PreviewBanner text="Surface Type playground — contracts/stubs until full engines ship." />
      {options.map(option => {
        const on = preferences.surfacePreview === option.id
        return (
          <AppPressable
            key={option.id}
            onPress={() => {
              void selectionHaptic()
              void update({surfacePreview: option.id})
            }}>
            <Surface
              variant="contained"
              style={[
                styles.row,
                {
                  backgroundColor:
                    option.id === 'minimal'
                      ? 'transparent'
                      : on
                        ? colours.accentSubtle
                        : colours.surface,
                  borderColor: on ? colours.accent : colours.border,
                  borderRadius: radius.xlarge,
                  gap: spacing[3],
                  opacity: option.id === 'glass' ? 0.92 : 1,
                  padding: spacing[4],
                },
              ]}>
              <View style={{flex: 1, gap: 2}}>
                <AppText variant="label">{option.label}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {option.detail}
                </AppText>
              </View>
              {on ? <AppIcon name="check" colour={colours.accent} /> : null}
            </Surface>
          </AppPressable>
        )
      })}
      <AppButton
        variant="secondary"
        onPress={() => {
          void selectionHaptic()
        }}>
        Current · {preferences.surfacePreview}
      </AppButton>
    </SurfaceShell>
  )
}

const styles = StyleSheet.create({
  emoji: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  inputCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  screen: {flex: 1},
})
