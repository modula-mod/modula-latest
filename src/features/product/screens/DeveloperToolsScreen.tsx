import {ScrollView, StyleSheet, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const MCP_TOOLS = [
  'greenfield.doctor',
  'greenfield.manifest.validate',
  'greenfield.intelligence.layers',
  'greenfield.commands.list',
  'greenfield.dimon.status',
  'greenfield.nft.status',
  'greenfield.skill.template',
]

const CLI_COMMANDS = [
  'modula help',
  'modula doctor',
  'modula mcp info',
  'modula module validate <path>',
  'modula module init [--write]',
  'modula intelligence layers',
  'modula commands list',
  'modula focus presets',
  'modula dimon status',
  'modula nft status',
  'modula version',
]

const DOC_PATHS = [
  'docs/architecture/greenfield-mcp.md',
  'docs/architecture/modula-cli.md',
  'docs/architecture/module-standards.md',
  'docs/architecture/intelligence-architecture.md',
  'templates/modula-module/skill.md',
]

const RUN_COMMANDS = `pnpm mcp:greenfield
pnpm modula -- doctor`

const MCP_JSON_EXAMPLE = `{
  "mcpServers": {
    "modula-greenfield": {
      "command": "pnpm",
      "args": [
        "--filter",
        "@modula/greenfield-mcp",
        "exec",
        "node",
        "dist/stdio.js"
      ]
    }
  }
}`

export function DeveloperToolsScreen() {
  const router = useRouter()
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const wash =
    scheme === 'dark'
      ? ['#0B1416', colours.accentSubtle]
      : [colours.accentSubtle, colours.canvas]

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Developer Tools" />
      <ResponsiveContent maxWidth={760}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <LinearGradient
            colors={wash as [string, string]}
            style={[
              styles.hero,
              {
                borderRadius: radius.large,
                padding: spacing[5],
                gap: spacing[3],
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="accent">
              GREENFIELD MCP · MODULA CLI · LOCAL PREVIEW
            </AppText>
            <AppText variant="display">Developer tools studio.</AppText>
            <AppText variant="body" colour="textSecondary">
              Static foreshadowing for local Greenfield helpers. The MCP server and CLI describe
              contracts, commands, DIMON status, and module standards; they do not install modules,
              publish packages, run wallets, or execute blockchain operations.
            </AppText>
          </LinearGradient>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[3],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <View style={[styles.titleRow, {gap: spacing[2]}]}>
              <AppIcon name="developer" colour={colours.accent} size={18} />
              <AppText variant="headline">Greenfield MCP status</AppText>
            </View>
            <AppText variant="body" colour="textSecondary">
              Package exists: @modula/greenfield-mcp. Status: Preview helper over stdio for Cursor
              and other MCP clients. Runtime boundary: Node built-ins only; no MCP SDK, blockchain,
              wallet, or network client dependencies.
            </AppText>
            <View style={{gap: spacing[2]}}>
              {MCP_TOOLS.map(tool => (
                <AppText key={tool} variant="caption" colour="textSecondary">
                  · {tool}
                </AppText>
              ))}
            </View>
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[3],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <View style={[styles.titleRow, {gap: spacing[2]}]}>
              <AppIcon name="tools" colour={colours.accent} size={18} />
              <AppText variant="headline">Modula CLI commands</AppText>
            </View>
            <AppText variant="body" colour="textSecondary">
              Package exists: @modula/modula-cli. The CLI is a local Greenfield developer
              companion, not an installer, publisher, wallet, ledger, or blockchain client.
            </AppText>
            <View style={{gap: spacing[2]}}>
              {CLI_COMMANDS.map(command => (
                <AppText key={command} variant="caption" colour="textSecondary">
                  · {command}
                </AppText>
              ))}
            </View>
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[3],
                borderRadius: radius.large,
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="headline">How to run</AppText>
            <AppText
              selectable
              variant="caption"
              colour="textSecondary"
              style={styles.codeBlock}>
              {RUN_COMMANDS}
            </AppText>
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[3],
                borderRadius: radius.large,
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="headline">Cursor mcp.json</AppText>
            <AppText variant="caption" colour="textTertiary">
              Select or long-press this AppText block to copy the example into Cursor mcp.json.
            </AppText>
            <AppText
              selectable
              variant="caption"
              colour="textSecondary"
              style={styles.codeBlock}>
              {MCP_JSON_EXAMPLE}
            </AppText>
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.medium,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="headline">Docs paths</AppText>
            {DOC_PATHS.map(path => (
              <AppText key={path} selectable variant="caption" colour="textSecondary">
                {path}
              </AppText>
            ))}
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppButton onPress={() => router.push('/product/intelligence' as Href)}>
              Intelligence Hub
            </AppButton>
            <AppButton variant="secondary" onPress={() => router.push('/product/module-standards' as Href)}>
              Module Standards
            </AppButton>
            <AppButton variant="secondary" onPress={() => router.push('/product/forge' as Href)}>
              Forge
            </AppButton>
            <AppButton variant="ghost" onPress={() => router.push('/product/commands' as Href)}>
              Commands
            </AppButton>
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {borderWidth: StyleSheet.hairlineWidth, width: '100%'},
  card: {borderWidth: StyleSheet.hairlineWidth},
  titleRow: {alignItems: 'center', flexDirection: 'row'},
  codeBlock: {fontFamily: 'monospace'},
})
