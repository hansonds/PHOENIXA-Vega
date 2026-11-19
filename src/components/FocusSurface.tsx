import React, { forwardRef, ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';
import { Pressable } from '@amazon-devices/react-native-kepler';
import { dp } from '../theme/scale';
import { accentDiag, alpha, usePalette } from '../theme/theme';

export interface FocusSurfaceProps {
  onPress?: () => void;
  /** Size / margins of the whole surface */
  style?: StyleProp<ViewStyle>;
  /** Corner radius in dp (Android RoundedCornerShape); use a big number for circles */
  radius?: number;
  focusedScale?: number;
  /** Width of the two-colour border when focused, in dp (0 = none) */
  borderWidth?: number;
  glow?: boolean;
  hasTVPreferredFocus?: boolean;
  onFocused?: () => void;
  onBlurred?: () => void;
  nextFocusUp?: number;
  nextFocusDown?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  children: (focused: boolean) => ReactNode;
}

const ease = Easing.bezier(0.4, 0, 0.2, 1); // FastOutSlowIn

/**
 * A remote-friendly focusable surface: scales up, glows and gets an aurora gradient border
 * when focused. OK / Select triggers onPress. Same as FocusSurface in Android PHOENIXA.
 */
export const FocusSurface = forwardRef<any, FocusSurfaceProps>(function FocusSurface(
  {
    onPress, style, radius = 14, focusedScale = 1.05, borderWidth = 2.5, glow = true,
    hasTVPreferredFocus, onFocused, onBlurred, nextFocusUp, nextFocusDown, nextFocusLeft, nextFocusRight, children,
  },
  ref,
) {
  const P = usePalette();
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: focused ? focusedScale : 1,
      duration: 130,
      easing: ease,
      useNativeDriver: true,
    }).start();
  }, [focused, focusedScale, scale]);

  const r = dp(radius);
  const bw = focused && borderWidth > 0 ? dp(borderWidth) : 0;

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocused?.();
      }}
      onBlur={() => {
        setFocused(false);
        onBlurred?.();
      }}
      hasTVPreferredFocus={hasTVPreferredFocus}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      style={style}
    >
      <Animated.View
        style={{
          flexGrow: 1,
          borderRadius: r,
          transform: [{ scale }],
          boxShadow: focused && glow ? `0px ${dp(8)}px ${dp(22)}px ${alpha(P.accent2, 0.55)}` : undefined,
        }}
      >
        <View
          style={{
            flexGrow: 1,
            borderRadius: r,
            overflow: 'hidden',
            padding: bw,
            experimental_backgroundImage: bw > 0 ? accentDiag(P) : undefined,
          }}
        >
          <View style={{ flexGrow: 1, borderRadius: Math.max(0, r - bw), overflow: 'hidden' }}>{children(focused)}</View>
        </View>
      </Animated.View>
    </Pressable>
  );
});
