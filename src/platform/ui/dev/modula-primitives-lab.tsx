import {StyleSheet, View} from 'react-native'
import {useState} from 'react'

import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {Surface} from '@/components/primitives/Surface'
import {ModuleCatalogueCard} from '@/features/modules/components/ModuleCatalogueCard'
import {ModuleInstallProgress} from '@/features/modules/components/ModuleInstallProgress'
import {ModuleStatusPill} from '@/features/modules/components/ModuleStatusPill'
import type {ModuleCatalogueItem} from '@/data/repositories/contracts'
import {StoryRingAvatar} from '@/platform/ui/avatars/StoryRingAvatar'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import {ModulaFieldShell} from '@/platform/ui/controls/modula-field-shell'
import {ModulaOTPField} from '@/platform/ui/controls/modula-otp-field'
import {ModulaSearchField} from '@/platform/ui/controls/modula-search-field'
import {ModulaSecureField} from '@/platform/ui/controls/modula-secure-field'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {ModulaSwitch} from '@/platform/ui/controls/modula-switch'
import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
import {ModulaIcon} from '@/platform/ui/icons'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaPopover} from '@/platform/ui/menus/modula-popover'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const SAMPLE_MODULE: ModuleCatalogueItem = {
  moduleId: 'digital.modula.vault-notes',
  name: 'Vault Notes',
  description: 'Private notes and saved knowledge.',
  publisherName: 'Modula',
  publisherId: 'modula',
  kind: 'module',
  category: 'Productivity',
  featured: true,
  installable: true,
  installationState: 'available',
  priceState: 'Free',
  trustLevel: 'firstParty',
  latestVersion: '1.1.0',
  compatibility: 'Compatible',
}

/**
 * State matrix for Modula primitives that flagship screens must prove in 7M-B2.
 */
export function ModulaPrimitivesLabScreen() {
  const {colours, spacing, radius} = useThemeTokens()
  const [segment, setSegment] = useState('Following')
  const [secure, setSecure] = useState('secret-value')
  const [otp, setOtp] = useState('')
  const [query, setQuery] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [popover, setPopover] = useState(false)
  const [sheet, setSheet] = useState(false)

  return (
    <View style={[styles.content, {gap: spacing[5]}]}>
      <AppText variant="display">Modula UI Lab</AppText>
      <AppText variant="body" colour="textSecondary">
        Typography, surface, icons, and controls in one matrix. Product screens import these wrappers — never SwiftUI directly.
      </AppText>

      <LabBlock title="Quality compare">
        <AppText variant="caption" colour="textSecondary">
          OLD / REFERENCE / MODULA NEW. References are linked, not copied, unless licensed.
        </AppText>
        {[
          ['Navigation', 'Rejected 7M-B2 glass-over-feed pill', 'Apple HIG: tabs are destinations', 'NAV-C hybrid: opaque chrome + compose accessory'],
          ['Fields', 'All auth fields as equal blocks', 'iOS AutoFill / progressive identity', 'Email → Continue → password or code'],
          ['Buttons', 'Teal on every action', 'Airbnb scarce accent', 'Primary only on Install / Sign in'],
          ['Menus', 'Custom overflow sheets only', 'SwiftUI Menu / Compose DropdownMenu', 'ModulaMenu + ContextMenu adapters'],
          ['Sheets', 'Card stack install UI', 'Native sheet', 'Install preview sheet + live stages'],
          ['Social', 'Post cards + dashboard banners', 'Threads/X continuous document', 'Hairline rows, Focus Halo stories'],
          ['Marketplace', 'Installed 0 / Available 1 pills', 'App Store editorial shelves', 'Featured / Made by Modula / Your modules'],
          ['Modules', 'Turquoise cube + Permission required', 'App Store identity imagery', 'ModuleArtwork + Available → Install → Open'],
          ['Motion', 'Decorative blur', 'Interruptible toolbar / grid magnification', 'Reaction proximity; no rope physics'],
          ['Media', 'Broken or generic icons', 'expo-image / artwork packs', 'Stories, posts, module art via existing media stack'],
        ].map(([section, old, reference, next]) => (
          <View key={section} style={{gap: 4}}>
            <AppText variant="label">{section}</AppText>
            <AppText variant="caption" colour="textTertiary">OLD · {old}</AppText>
            <AppText variant="caption" colour="textSecondary">REFERENCE · {reference}</AppText>
            <AppText variant="caption">MODULA NEW · {next}</AppText>
          </View>
        ))}
      </LabBlock>

      <LabBlock title="Typography">
        <AppText variant="display">Display</AppText>
        <AppText variant="headline">Headline</AppText>
        <AppText variant="label">Label</AppText>
        <AppText variant="body">Body copy for posts and forms.</AppText>
        <AppText variant="caption" colour="textSecondary">Caption / metadata</AppText>
      </LabBlock>

      <LabBlock title="Surface">
        <Surface variant="contained" style={{padding: spacing[4], borderRadius: radius.large, gap: spacing[2]}}>
          <AppText variant="label">Contained surface</AppText>
          <AppText variant="caption" colour="textSecondary">Canvas {String(colours.canvas)}</AppText>
        </Surface>
      </LabBlock>

      <LabBlock title="Icons">
        <View style={styles.row}>
          <ModulaIcon name="home" colour={colours.accent} />
          <ModulaIcon name="search" colour={colours.accent} />
          <ModulaIcon name="modules" colour={colours.accent} />
          <ModulaIcon name="settings" colour={colours.accent} />
        </View>
      </LabBlock>

      <LabBlock title="Buttons">
        <ModulaButton label="Primary" onPress={() => undefined} />
        <ModulaButton label="Secondary" role="secondary" onPress={() => undefined} />
        <ModulaButton label="Destructive" role="destructive" onPress={() => undefined} />
      </LabBlock>

      <LabBlock title="Fields">
        <ModulaFieldShell label="Name" support="Used on your profile.">
          <ModulaTextInput value="Ada" onChangeText={() => undefined} />
        </ModulaFieldShell>
      </LabBlock>

      <LabBlock title="OTP">
        <ModulaOTPField value={otp} onChangeValue={setOtp} />
      </LabBlock>

      <LabBlock title="Search">
        <ModulaSearchField value={query} onChangeText={setQuery} placeholder="Search Modula" />
      </LabBlock>

      <LabBlock title="Secure field">
        <ModulaSecureField value={secure} onChangeText={setSecure} label="Password" />
      </LabBlock>

      <LabBlock title="Segmented control">
        <ModulaSegmentedPicker
          appearance="segmented"
          options={[{value: 'Following', label: 'Following'}, {value: 'For You', label: 'For You'}]}
          value={segment}
          onValueChange={setSegment}
        />
      </LabBlock>

      <LabBlock title="Switch">
        <ModulaSwitch value={enabled} onValueChange={setEnabled} accessibilityLabel="Enabled" />
      </LabBlock>

      <LabBlock title="Sheet">
        <ModulaButton label="Show sheet" role="secondary" onPress={() => setSheet(true)} />
        <ModulaSheet isPresented={sheet} onDismiss={() => setSheet(false)} snapPoints={['half']}>
          <AppText variant="headline">Sheet</AppText>
          <AppText variant="body" colour="textSecondary">Install review and overflow actions use this adapter.</AppText>
        </ModulaSheet>
      </LabBlock>

      <LabBlock title="Popover">
        <ModulaPopover
          isOpen={popover}
          onDismiss={() => setPopover(false)}
          trigger={<ModulaButton label={popover ? 'Hide popover' : 'Show popover'} role="secondary" onPress={() => setPopover(open => !open)} />}>
          <AppText variant="body">Popover sample.</AppText>
        </ModulaPopover>
      </LabBlock>

      <LabBlock title="Context menu">
        <ModulaContextMenu
          accessibilityLabel="Sample context menu"
          actions={[{id: 'open', label: 'Open'}, {id: 'share', label: 'Share'}]}
          onAction={() => undefined}>
          <AppText variant="body">Long-press this row for the context menu adapter.</AppText>
        </ModulaContextMenu>
      </LabBlock>

      <LabBlock title="Drawer">
        <AppText variant="body" colour="textSecondary">
          Navigation drawer is the existing shell adapter (`NavigationDrawer` + `ShellDrawerContext`). Do not add a second drawer primitive.
        </AppText>
      </LabBlock>

      <LabBlock title="Avatar">
        <Avatar name="Modula" colour="#369CAA" size={44} />
      </LabBlock>

      <LabBlock title="Story Ring">
        <View style={styles.row}>
          <StoryRingAvatar name="You" colour="#369CAA" size={56} />
          <StoryRingAvatar name="Ada" colour="#369CAA" size={56} seen />
        </View>
      </LabBlock>

      <LabBlock title="Post Card">
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
          <Avatar name="Modula" colour="#369CAA" size={36} />
          <View style={{flex: 1, gap: 2}}>
            <AppText variant="label">Modula</AppText>
            <AppText variant="body">Content dominates chrome. Posts are a stream, not dashboard cards.</AppText>
          </View>
        </View>
      </LabBlock>

      <LabBlock title="Reaction Picker">
        <View style={styles.row}>
          {['👍', '❤️', '😂', '🔥'].map(emoji => (
            <AppText key={emoji} variant="title">{emoji}</AppText>
          ))}
        </View>
        <AppText variant="caption" colour="textSecondary">
          Tap Like. Long-press for proximity row. Web/screen reader uses a standard menu.
        </AppText>
      </LabBlock>

      <LabBlock title="Comment Thread">
        <View style={{gap: spacing[2], paddingLeft: spacing[2]}}>
          <AppText variant="label">Ada</AppText>
          <AppText variant="body">Comment affordance opens the post thread, not a dashboard card.</AppText>
          <AppText variant="caption" colour="textSecondary">Reply · 2m</AppText>
        </View>
      </LabBlock>

      <LabBlock title="Module Card">
        <ModuleCatalogueCard item={SAMPLE_MODULE} onPress={() => undefined} />
      </LabBlock>

      <LabBlock title="Install Button">
        <ModulaButton label="Install" accessibilityLabel="Install Vault Notes" onPress={() => undefined} />
      </LabBlock>

      <LabBlock title="Install Progress">
        <ModuleInstallProgress productName="Vault Notes" stage="permissions" />
      </LabBlock>

      <LabBlock title="Permissions">
        <AppText variant="body" colour="textSecondary">• Store Vault Notes records</AppText>
        <AppText variant="body" colour="textSecondary">• Read its own records</AppText>
        <AppText variant="body" colour="textSecondary">• Search its own records</AppText>
      </LabBlock>

      <LabBlock title="Module Status">
        <View style={styles.row}>
          <ModuleStatusPill state="available" />
          <ModuleStatusPill state="enabled" />
          <ModuleStatusPill state="updateAvailable" />
        </View>
      </LabBlock>
    </View>
  )
}

function LabBlock({title, children}: {title: string; children: React.ReactNode}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}} testID={`ui-lab-${title.toLowerCase().split(' ')[0]}`}>
      <AppText variant="headline">{title}</AppText>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  content: {paddingBottom: 48},
  row: {flexDirection: 'row', gap: 16},
})
