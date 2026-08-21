import {StyleSheet, View, useWindowDimensions} from 'react-native'

import {AppImage} from '@/components/primitives/AppImage'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const VAULT_NOTES_COVER = require('../../../../../assets/images/product-hub/vault-notes-cover.png')

export function ProductCover({
  moduleId,
  name,
  inset = true,
}: {
  moduleId: string
  name: string
  inset?: boolean
}) {
  const {width} = useWindowDimensions()
  const {colours, radius} = useThemeTokens()
  const contentWidth = Math.min(width, 1120)
  const height = Math.min(300, Math.max(176, Math.round(contentWidth * 0.36)))
  const source = moduleId === 'digital.modula.vault-notes' ? VAULT_NOTES_COVER : null

  return (
    <View
      accessibilityLabel={`${name} cover artwork`}
      style={[
        styles.cover,
        {
          backgroundColor: colours.surfaceRaised,
          borderRadius: inset ? radius.xlarge : 0,
          height,
        },
      ]}
      testID="product-cover">
      {source ? (
        <AppImage
          accessibilityLabel={`${name} editorial cover`}
          source={source}
          contentFit="cover"
          contentPosition="center"
          transition={160}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <ModuleArtwork moduleId={moduleId} name={name} variant="scene" sceneHeight={height} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  cover: {
    overflow: 'hidden',
    width: '100%',
  },
})
