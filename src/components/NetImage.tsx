import React, { useEffect, useRef, useState } from 'react';
import { Animated, ImageResizeMode, ImageStyle, StyleProp } from 'react-native';

/**
 * A picture from the server that fades in when it has loaded (Coil's crossfade(250) on Android).
 * onError lets callers fall back, e.g. to the title text when a logo is missing.
 */
export function NetImage({
  uri, style, resizeMode = 'cover', onError, fade = 250,
}: {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  onError?: () => void;
  fade?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    opacity.setValue(0);
    setFailed(false);
  }, [uri, opacity]);

  if (!uri || failed) return null;
  return (
    <Animated.Image
      source={{ uri }}
      resizeMode={resizeMode}
      style={[style, { opacity }]}
      onLoad={() => Animated.timing(opacity, { toValue: 1, duration: fade, useNativeDriver: true }).start()}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}
