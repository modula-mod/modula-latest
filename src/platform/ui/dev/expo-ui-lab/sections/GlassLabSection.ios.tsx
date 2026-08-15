import {Button, Menu, Section, VStack} from '@expo/ui/swift-ui'
import {buttonStyle} from '@expo/ui/swift-ui/modifiers'

/**
 * Controlled Liquid Glass examples. Product screens must not import this file.
 *
 * Glass Menu must use buttonStyle('glass') on the Menu. Do not apply
 * glassEffect() to the label (halo artifact: expo/expo#43953).
 *
 * GLASS_FORBIDDEN: feed cells, module cards, form backgrounds, tab bar over moving text.
 */
export function GlassLabSection() {
  return (
    <Section title="Liquid Glass lab">
      <VStack spacing={10}>
        <Button label="Glass button" systemImage="sparkles" modifiers={[buttonStyle('glass')]} />
        <Button label="Glass toolbar item" systemImage="square.and.arrow.up" modifiers={[buttonStyle('glass')]} />
        <Button
          label="Glass floating action"
          systemImage="plus"
          modifiers={[buttonStyle('glassProminent')]}
        />
        <Menu label="Glass menu" systemImage="ellipsis" modifiers={[buttonStyle('glass')]}>
          <Button label="Photo" systemImage="photo" onPress={() => undefined} />
          <Button label="Camera" systemImage="camera" onPress={() => undefined} />
          <Button label="GIF" systemImage="gift" onPress={() => undefined} />
        </Menu>
        <Menu label="Glass grouped actions" systemImage="slider.horizontal.3" modifiers={[buttonStyle('glass')]}>
          <Button label="Install" onPress={() => undefined} />
          <Button label="Share" onPress={() => undefined} />
        </Menu>
      </VStack>
    </Section>
  )
}
