import {StyleSheet, View, useWindowDimensions} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'

import {AppImage} from '@/components/primitives/AppImage'
import {ProgressiveBlurBand} from '@/components/materials/ProgressiveBlurBand'
import {ModuleArtwork} from '@/features/modules/components/ModuleArtwork'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const VAULT_NOTES_COVER = require('../../../../../assets/images/product-hub/vault-notes-cover.png')

function colourWithAlpha(colour: string, alpha: number): string {
  const hex = colour.match(/^#([0-9a-f]{6})$/i)?.[1]
  if (!hex) return colour
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function ProductCover({
  moduleId,
  name,
  inset = true,
  transitionToCanvas = false,
}: {
  moduleId: string
  name: string
  inset?: boolean
  transitionToCanvas?: boolean
}) {
  const {width} = useWindowDimensions()
  const {colours, radius} = useThemeTokens()
  const contentWidth = Math.min(width, 1120)
  const height = transitionToCanvas
    ? Math.min(420, Math.max(300, Math.round(contentWidth * 0.76)))
    : Math.min(300, Math.max(176, Math.round(contentWidth * 0.36)))
  const transitionHeight = Math.min(160, Math.max(122, Math.round(height * 0.46)))
  const canvasClear = colourWithAlpha(colours.canvas, 0)
  const canvasWash = colourWithAlpha(colours.canvas, 0.76)
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
      {transitionToCanvas ? (
        <>
          <ProgressiveBlurBand
            height={transitionHeight}
            topHeavy={false}
            intensity={86}
            style={styles.transition}
          />
          <LinearGradient
            colors={[canvasClear, canvasWash, colours.canvas]}
            locations={[0, 0.62, 1]}
            pointerEvents="none"
            style={[styles.transition, {height: transitionHeight}]}
          />
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  cover: {
    overflow: 'hidden',
    width: '100%',
  },
  transition: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
})
