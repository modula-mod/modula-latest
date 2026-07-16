import {Image, type ImageProps} from 'expo-image'
import type {StyleProp, ImageStyle} from 'react-native'

type AppImageProps = Omit<ImageProps, 'style'> & {
  style?: StyleProp<ImageStyle>
}

/**
 * expo-image wrapper. Prefer this over React Native Image.
 */
export function AppImage({contentFit = 'cover', ...rest}: AppImageProps) {
  return <Image contentFit={contentFit} {...rest} />
}
