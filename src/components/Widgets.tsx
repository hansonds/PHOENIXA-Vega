import React, { forwardRef, ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, Text, View, ViewStyle } from 'react-native';
import {
  Item, episodeLabel, isEpisode, isSeries, progress as itemProgress, qualityBadges, runtimeMinutes,
} from '../data/models';
import { api } from '../data/jellyfin';
import { dp, sp } from '../theme/scale';
import { Fixed, NovaType, accentDiag, accentH, alpha, usePalette } from '../theme/theme';
import { UiScale } from '../theme/uiScale';
import { FocusSurface } from './FocusSurface';
import { Icon, IconName } from './Icon';
import { NetImage } from './NetImage';

export const formatRuntime = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p2(m)}:${p2(sec)}` : `${m}:${p2(sec)}`;
}

/** "h:mm AM" like SimpleDateFormat("h:mm a") */
export function clockText(d: Date): string {
  let h = d.getHours();
  const am = h < 12;
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}

// ---------- Buttons & chips ----------

export const NovaButton = forwardRef<any, {
  text: string;
  icon?: IconName;
  primary?: boolean;
  style?: StyleProp<ViewStyle>;
  hasTVPreferredFocus?: boolean;
  onFocused?: () => void;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  onPress: () => void;
}>(function NovaButton({ text, icon, primary = false, style, hasTVPreferredFocus, onFocused, nextFocusLeft, nextFocusRight, onPress }, ref) {
  const P = usePalette();
  return (
    <FocusSurface
      ref={ref}
      onPress={onPress}
      style={[{ height: dp(48) }, style]}
      radius={24}
      focusedScale={1.06}
      borderWidth={0}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocused={onFocused}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
    >
      {focused => {
        const fg = focused ? P.onFocus : P.text;
        return (
          <View
            style={{
              height: dp(48),
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: text ? dp(22) : dp(12),
              borderRadius: dp(24),
              borderWidth: dp(1),
              borderColor: focused ? 'transparent' : Fixed.stroke,
              backgroundColor: focused ? P.focus : undefined,
              experimental_backgroundImage: focused
                ? undefined
                : primary
                  ? 'linear-gradient(to right, #FFFFFF40 0%, #FFFFFF26 100%)'
                  : 'linear-gradient(to right, #FFFFFF24 0%, #FFFFFF14 100%)',
            }}
          >
            {icon ? <Icon name={icon} size={22} color={fg} /> : null}
            {icon && text ? <View style={{ width: dp(10) }} /> : null}
            {text ? <Text style={[NovaType.Button, { color: fg }]}>{text}</Text> : null}
          </View>
        );
      }}
    </FocusSurface>
  );
});

export function GlassChip({ text, accent, style }: { text: string; accent?: string; style?: StyleProp<ViewStyle> }) {
  const P = usePalette();
  return (
    <View
      style={[
        {
          borderRadius: dp(8),
          backgroundColor: accent ? alpha(accent, 0.16) : Fixed.white12,
          borderWidth: dp(1),
          borderColor: accent ? alpha(accent, 0.45) : Fixed.stroke,
          paddingHorizontal: dp(10),
          paddingVertical: dp(4),
        },
        style,
      ]}
    >
      <Text numberOfLines={1} style={[NovaType.Label, { color: accent ?? P.text }]}>{text}</Text>
    </View>
  );
}

export function MetaRow({ item, showEpisode = true, style }: { item: Item; showEpisode?: boolean; style?: StyleProp<ViewStyle> }) {
  const P = usePalette();
  const parts: ReactNode[] = [];
  if (item.communityRating !== null) {
    parts.push(
      <View key="r" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="star" size={16} color={Fixed.gold} />
        <View style={{ width: dp(4) }} />
        <Text style={[NovaType.Label, { color: P.text }]}>{item.communityRating.toFixed(1)}</Text>
      </View>,
    );
  }
  if (item.criticRating !== null) parts.push(<Text key="c" style={[NovaType.Label, { color: P.text }]}>🍅 {item.criticRating}%</Text>);
  if (item.year !== null) parts.push(<Text key="y" style={[NovaType.Label, { color: P.textDim }]}>{item.year}</Text>);
  const ep = showEpisode ? episodeLabel(item) : null;
  if (ep) parts.push(<Text key="e" style={[NovaType.Label, { color: P.accent }]}>{ep}</Text>);
  if (isSeries(item) && item.childCount !== null) {
    parts.push(
      <Text key="s" style={[NovaType.Label, { color: P.textDim }]}>
        {item.childCount} Season{item.childCount === 1 ? '' : 's'}
      </Text>,
    );
  } else if (runtimeMinutes(item) > 0) {
    parts.push(<Text key="t" style={[NovaType.Label, { color: P.textDim }]}>{formatRuntime(runtimeMinutes(item))}</Text>);
  }
  if (item.officialRating) parts.push(<GlassChip key="o" text={item.officialRating} />);
  qualityBadges(item).forEach(b => parts.push(<GlassChip key={'q' + b} text={b} accent={P.accent} />));
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: dp(12), rowGap: dp(8) }, style]}>
      {parts}
    </View>
  );
}

export function ProgressBar({ progress, height = 4, style }: { progress: number; height?: number; style?: StyleProp<ViewStyle> }) {
  const P = usePalette();
  return (
    <View style={[{ height: dp(height), borderRadius: dp(height), backgroundColor: Fixed.white25, overflow: 'hidden' }, style]}>
      <View
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
          borderRadius: dp(height),
          experimental_backgroundImage: accentH(P),
        }}
      />
    </View>
  );
}

export function ShimmerBox({ style }: { style?: StyleProp<ViewStyle> }) {
  const P = usePalette();
  const a = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 0.7, duration: 900, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.35, duration: 900, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[{ backgroundColor: P.surfaceHi, opacity: a }, style]} />;
}

const fill = { position: 'absolute' as const, left: 0, top: 0, right: 0, bottom: 0 };

export const PosterCard = forwardRef<any, {
  item: Item;
  onPress: () => void;
  width?: number;
  showTitle?: boolean;
  hasTVPreferredFocus?: boolean;
  onFocused?: () => void;
  nextFocusUp?: number;
}>(function PosterCard({ item, onPress, width = UiScale.posterWidth, showTitle = false, hasTVPreferredFocus, onFocused, nextFocusUp }, ref) {
  const P = usePalette();
  const poster = api.poster(item, 360);
  const prog = itemProgress(item);
  return (
    <View style={{ width: dp(width) }}>
      <FocusSurface
        ref={ref}
        onPress={onPress}
        style={{ width: dp(width), height: dp(width * 1.5) }}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocused={onFocused}
        nextFocusUp={nextFocusUp}
      >
        {() => (
          <View style={{ flexGrow: 1 }}>
            <ShimmerBox style={fill} />
            <NetImage uri={poster} style={fill} />
            {!poster ? (
              <View style={[fill, { alignItems: 'center', justifyContent: 'center', padding: dp(12) }]}>
                <Text style={[NovaType.Section, { color: P.text, textAlign: 'center' }]}>{item.name}</Text>
              </View>
            ) : null}
            {item.played ? (
              <View style={{ position: 'absolute', top: dp(8), right: dp(8), borderRadius: dp(11), backgroundColor: alpha(P.bg, 0.6) }}>
                <Icon name="check_circle" size={22} color={P.accent} />
              </View>
            ) : (item.unplayedCount ?? 0) > 0 ? (
              <View
                style={{
                  position: 'absolute', top: dp(8), right: dp(8), borderRadius: dp(10),
                  experimental_backgroundImage: accentDiag(P), paddingHorizontal: dp(8), paddingVertical: dp(2),
                }}
              >
                <Text style={[NovaType.Label, { color: P.onFocus, fontWeight: '700' }]}>{item.unplayedCount}</Text>
              </View>
            ) : null}
            {prog > 0 && !item.played ? (
              <ProgressBar progress={prog} style={{ position: 'absolute', left: dp(8), right: dp(8), bottom: dp(8) }} />
            ) : null}
          </View>
        )}
      </FocusSurface>
      {showTitle ? (
        <>
          <View style={{ height: dp(8) }} />
          <Text numberOfLines={1} style={[NovaType.Label, { color: P.text }]}>{item.name}</Text>
          <Text numberOfLines={1} style={[NovaType.Label, { fontSize: sp(12), color: P.textFaint }]}>
            {item.year !== null ? String(item.year) : ''}
          </Text>
        </>
      ) : null}
    </View>
  );
});

export const LandscapeCard = forwardRef<any, {
  item: Item;
  onPress: () => void;
  width?: number;
  subtitle?: string | null;
  hasTVPreferredFocus?: boolean;
  onFocused?: () => void;
  nextFocusUp?: number;
}>(function LandscapeCard({ item, onPress, width = UiScale.landscapeWidth, subtitle, hasTVPreferredFocus, onFocused, nextFocusUp }, ref) {
  const P = usePalette();
  const prog = itemProgress(item);
  const sub =
    subtitle ?? (isEpisode(item) ? [episodeLabel(item), item.name].filter(Boolean).join(' · ') : item.year !== null ? String(item.year) : null);
  return (
    <FocusSurface
      ref={ref}
      onPress={onPress}
      style={{ width: dp(width), height: dp((width * 9) / 16) }}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocused={onFocused}
      nextFocusUp={nextFocusUp}
    >
      {() => (
        <View style={{ flexGrow: 1 }}>
          <ShimmerBox style={fill} />
          <NetImage uri={api.landscape(item, 640)} style={fill} />
          <View style={[fill, { experimental_backgroundImage: `linear-gradient(to bottom, transparent 35%, ${alpha(P.bgDeep, 0.9)} 100%)` }]} />
          <View style={{ position: 'absolute', left: dp(12), right: dp(12), bottom: dp(12) }}>
            <Text numberOfLines={1} style={[NovaType.Label, { fontSize: sp(15), fontWeight: '600', color: P.text }]}>
              {isEpisode(item) ? item.seriesName ?? item.name : item.name}
            </Text>
            {sub ? <Text numberOfLines={1} style={[NovaType.Label, { fontSize: sp(12), color: P.textDim }]}>{sub}</Text> : null}
            {prog > 0 && !item.played ? (
              <>
                <View style={{ height: dp(8) }} />
                <ProgressBar progress={prog} height={3} />
              </>
            ) : null}
          </View>
        </View>
      )}
    </FocusSurface>
  );
});

export function SectionTitle({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const P = usePalette();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <View style={{ width: dp(4), height: dp(18), borderRadius: dp(2), experimental_backgroundImage: accentDiag(P) }} />
      <View style={{ width: dp(10) }} />
      <Text style={[NovaType.Section, { color: P.text }]}>{text}</Text>
    </View>
  );
}

export function CenterMessage({ title, subtitle, action }: { title: string; subtitle?: string | null; action?: ReactNode }) {
  const P = usePalette();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={[NovaType.Title, { color: P.text }]}>{title}</Text>
      {subtitle ? (
        <>
          <View style={{ height: dp(8) }} />
          <Text style={[NovaType.Body, { color: P.textDim, textAlign: 'center' }]}>{subtitle}</Text>
        </>
      ) : null}
      {action ? (
        <>
          <View style={{ height: dp(24) }} />
          {action}
        </>
      ) : null}
    </View>
  );
}

/** Spinning two-colour ring */
export function NovaLoader({ size = 56, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const P = usePalette();
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(rot, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [rot]);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View
        style={{
          width: dp(size),
          height: dp(size),
          borderRadius: dp(size / 2),
          borderWidth: dp(5),
          borderTopColor: P.accent,
          borderRightColor: P.accent2,
          borderBottomColor: alpha(P.accent2, 0.35),
          borderLeftColor: 'transparent',
          transform: [{ rotate: spin }],
        }}
      />
    </View>
  );
}
