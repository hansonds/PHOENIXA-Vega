import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { alpha, usePalette } from '../theme/theme';

interface Layer {
  key: number;
  uri: string;
  opacity: Animated.Value;
}

let layerKey = 0;

/**
 * Full-bleed cinematic backdrop with slow Ken Burns drift and layered scrims
 * (BackdropLayer in Android PHOENIXA). New pictures cross-fade in over 800 ms.
 */
export function BackdropLayer({ uri, kenBurns, dim }: { uri: string | null; kenBurns: boolean; dim: number }) {
  const P = usePalette();
  const [layers, setLayers] = useState<Layer[]>([]);
  const drift = useRef(new Animated.Value(1)).current;
  const dimA = useRef(new Animated.Value(dim)).current;

  // Cross-fade to the new picture
  useEffect(() => {
    if (!uri) return;
    setLayers(prev => {
      if (prev.length && prev[prev.length - 1].uri === uri) return prev;
      return [...prev.slice(-1), { key: layerKey++, uri, opacity: new Animated.Value(0) }];
    });
  }, [uri]);

  // Ken Burns: 1.0 -> 1.09 over 22 s, back and forth
  useEffect(() => {
    if (!kenBurns) {
      drift.setValue(1.04);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1.09, duration: 22000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 1.0, duration: 22000, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [kenBurns, drift]);

  useEffect(() => {
    Animated.timing(dimA, { toValue: dim, duration: 500, useNativeDriver: true }).start();
  }, [dim, dimA]);

  const onLoaded = (l: Layer) => {
    Animated.timing(l.opacity, { toValue: 1, duration: 800, useNativeDriver: true }).start(() => {
      // Drop the older picture once the new one fully covers it
      setLayers(prev => (prev.length > 1 && prev[prev.length - 1].key === l.key ? [l] : prev));
    });
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {layers.map(l => (
        <Animated.Image
          key={l.key}
          source={{ uri: l.uri }}
          resizeMode="cover"
          onLoad={() => onLoaded(l)}
          style={[
            StyleSheet.absoluteFill,
            { opacity: l.opacity, transform: [{ scale: drift }], transformOrigin: '70% 30%' },
          ]}
        />
      ))}
      {/* left scrim for text legibility */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage: `linear-gradient(to right, ${alpha(P.bg, 0.94)} 0%, ${alpha(P.bg, 0.62)} 38%, transparent 72%)`,
          },
        ]}
      />
      {/* bottom fade into page */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage:
              `linear-gradient(to bottom, ${alpha(P.bg, 0.55)} 0%, transparent 18%, transparent 55%, ` +
              `${alpha(P.bg, 0.92)} 86%, ${P.bg.slice(0, 7)} 100%)`,
          },
        ]}
      />
      {/* aurora tint */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage: `linear-gradient(135deg, ${alpha(P.accent, 0.1)} 0%, transparent 50%, ${alpha(P.accent2, 0.12)} 100%)`,
          },
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: P.bgDeep.slice(0, 7), opacity: dimA }]} />
    </View>
  );
}
