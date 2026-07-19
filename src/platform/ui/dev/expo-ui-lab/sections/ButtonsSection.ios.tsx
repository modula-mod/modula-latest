import {Button, Section, VStack} from '@expo/ui/swift-ui'
import {
  buttonStyle,
  controlSize,
  foregroundStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers'

/** Port of expo-ui-playground Buttons + glass variants (SDK 57 APIs). */
export function ButtonsSection() {
  return (
    <Section title="Buttons">
      <VStack spacing={10}>
        <Button label="Default" />
        <Button
          label="Bordered"
          modifiers={[buttonStyle('bordered'), controlSize('regular')]}
        />
        <Button label="Plain" modifiers={[buttonStyle('plain')]} />
        <Button
          label="Bordered Prominent"
          modifiers={[buttonStyle('borderedProminent')]}
        />
        <Button
          label="Glass"
          systemImage="sparkles"
          modifiers={[buttonStyle('glass')]}
        />
        <Button
          label="Glass Prominent"
          systemImage="camera"
          modifiers={[buttonStyle('glassProminent'), tint('#369CAA')]}
        />
        <Button
          label="Take a photo"
          systemImage="camera"
          modifiers={[buttonStyle('glass')]}
        />
        <Button
          label="Share with friends"
          systemImage="square.and.arrow.up"
          modifiers={[buttonStyle('glass')]}
        />
        <Button
          label="Help & support"
          systemImage="questionmark.circle"
          modifiers={[
            buttonStyle('glassProminent'),
            tint('orange'),
            foregroundStyle('white'),
          ]}
        />
        <Button
          label="Sign out"
          systemImage="power"
          role="destructive"
          modifiers={[buttonStyle('glassProminent')]}
        />
      </VStack>
    </Section>
  )
}
