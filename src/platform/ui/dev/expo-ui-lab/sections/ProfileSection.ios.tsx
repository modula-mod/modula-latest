import {
  Button,
  ColorPicker,
  DisclosureGroup,
  Group,
  HStack,
  Image,
  LabeledContent,
  Picker,
  Section,
  Spacer,
  Text,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui'
import {
  background,
  buttonStyle,
  clipShape,
  controlSize,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers'
import {Image as ExpoImage} from 'expo-image'
import {useState} from 'react'

import {useExpoUiLab} from '@/platform/ui/dev/expo-ui-lab/LabContext'

export function ProfileSection() {
  const {profile, updateProfile} = useExpoUiLab()
  const [profileExpanded, setProfileExpanded] = useState(false)
  const [isAirplaneMode, setIsAirplaneMode] = useState(false)

  const profileSizes = ['small', 'medium', 'large'] as const
  const imageSize =
    profile.profileImageSize === 'large'
      ? 80
      : profile.profileImageSize === 'medium'
        ? 60
        : 40

  return (
    <Section title="User Profile">
      <HStack spacing={16}>
        <HStack
          modifiers={[
            frame({width: imageSize, height: imageSize}),
            cornerRadius(100),
          ]}>
          <ExpoImage
            source={{uri: 'https://github.com/betomoedano.png'}}
            style={{width: imageSize, height: imageSize}}
            contentFit="cover"
          />
        </HStack>
        <VStack spacing={4} alignment="leading">
          <Text
            modifiers={[
              font({size: 22, weight: 'bold'}),
              foregroundStyle(profile.theme),
            ]}>
            {profile.name}
          </Text>
          <Text modifiers={[foregroundStyle('gray')]}>{profile.username}</Text>
        </VStack>
      </HStack>

      <HStack spacing={8}>
        <Image
          systemName="airplane"
          color="white"
          size={18}
          modifiers={[
            frame({width: 28, height: 28}),
            background('#ffa500'),
            clipShape('roundedRectangle'),
          ]}
        />
        <Text>Airplane Mode</Text>
        <Spacer />
        <Toggle isOn={isAirplaneMode} onIsOnChange={setIsAirplaneMode} />
      </HStack>

      <LabeledContent label="Mini Button">
        <Button
          label="Mini"
          modifiers={[buttonStyle('bordered'), controlSize('mini')]}
        />
      </LabeledContent>
      <LabeledContent label="Small Button">
        <Button
          label="Small"
          modifiers={[buttonStyle('bordered'), controlSize('small')]}
        />
      </LabeledContent>
      <LabeledContent label="Regular Button">
        <Button
          label="Regular"
          modifiers={[buttonStyle('bordered'), controlSize('regular')]}
        />
      </LabeledContent>
      <LabeledContent label="Large Button">
        <Button
          label="Large"
          modifiers={[buttonStyle('bordered'), controlSize('large')]}
        />
      </LabeledContent>
      <LabeledContent label="Glass Prominent">
        <Button
          label="Help & Support"
          modifiers={[
            buttonStyle('glassProminent'),
            controlSize('large'),
            tint('#369CAA'),
            foregroundStyle('white'),
          ]}
        />
      </LabeledContent>

      <DisclosureGroup
        label="Profile Settings"
        isExpanded={profileExpanded}
        onIsExpandedChange={setProfileExpanded}>
        <Picker
          label="Profile Image Size"
          selection={profile.profileImageSize}
          onSelectionChange={selection => {
            if (
              typeof selection === 'string' &&
              profileSizes.includes(selection as (typeof profileSizes)[number])
            ) {
              updateProfile({
                profileImageSize: selection as (typeof profileSizes)[number],
              })
            }
          }}>
          {profileSizes.map(size => (
            <Text key={size} modifiers={[tag(size)]}>
              {size}
            </Text>
          ))}
        </Picker>

        <ColorPicker
          label="Theme Color"
          selection={profile.theme}
          supportsOpacity={false}
          onSelectionChange={color => updateProfile({theme: color})}
        />
      </DisclosureGroup>

      <Group
        modifiers={[
          glassEffect({glass: {variant: 'regular', interactive: true}}),
          frame({width: 100, height: 100}),
          cornerRadius(16),
        ]}>
        <Image systemName="applelogo" size={40} />
      </Group>
    </Section>
  )
}
